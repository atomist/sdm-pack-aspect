/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    HttpClientFactory,
    logger,
} from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    ExtensionPackMetadata,
    metadata,
} from "@atomist/sdm";
import {
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { Aspect } from "@atomist/sdm-pack-fingerprint/lib/machine/Aspect";
import * as bodyParser from "body-parser";
import {
    Express,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import * as path from "path";
import { CSSProperties } from "react";
import serveStatic = require("serve-static");
import {
    ProjectAspectForDisplay,
    ProjectFingerprintForDisplay,
    RepoExplorer,
} from "../../../views/repository";
import {
    SunburstPage,
} from "../../../views/sunburstPage";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { AnalysisTracking } from "../../analysis/tracking/analysisTracker";
import { exposeAnalysisTrackingPage } from "../../analysis/tracking/analysisTrackingRoutes";
import {
    AspectRegistry,
} from "../../aspect/AspectRegistry";
import {
    defaultedToDisplayableFingerprint,
    defaultedToDisplayableFingerprintName,
} from "../../aspect/DefaultAspectRegistry";
import { CustomReporters } from "../../customize/customReporters";
import { PlantedTree } from "../../tree/sunburst";
import { visit } from "../../tree/treeUtils";
import {
    describeSelectedTagsToAnimals,
    TagTree,
} from "../api";
import { exposeOverviewPage } from "./overviewPage";
import { exposeRepositoryListPage } from "./repositoryListPage";
import { WebAppConfig } from "./webAppConfig";

/**
 * Add the org page route to Atomist SDM Express server.
 * @return {ExpressCustomizer}
 */
export function addWebAppRoutes(
    aspectRegistry: AspectRegistry,
    store: ProjectAnalysisResultStore,
    analysisTracking: AnalysisTracking,
    httpClientFactory: HttpClientFactory,
    instanceMetadata: ExtensionPackMetadata): {
        customizer: ExpressCustomizer,
        routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    } {
    const topLevelRoute = "/overview";
    return {
        routesToSuggestOnStartup: [{ title: "Atomist Visualizations", route: topLevelRoute }],
        customizer: (express: Express, ...handlers: RequestHandler[]) => {
            express.use(bodyParser.json());       // to support JSON-encoded bodies
            express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
                extended: true,
            }));

            express.use(serveStatic(path.join(__dirname, "..", "..", "..", "public"), { index: false }));
            express.use(serveStatic(path.join(__dirname, "..", "..", "..", "dist"), { index: false }));

            /* redirect / to the org page. This way we can go right here
             * for now, and later make a higher-level page if we want.
             */
            express.get("/", ...handlers, (req, res) => {
                res.redirect(topLevelRoute);
            });

            const conf: WebAppConfig = { express, handlers, aspectRegistry, store, instanceMetadata, httpClientFactory, analysisTracking };

            exposeDriftPage(conf);
            exposeOverviewPage(conf, topLevelRoute);
            exposeRepositoryListPage(conf);
            exposeRepositoryPage(conf);
            exposeExplorePage(conf);
            exposeFingerprintReportPage(conf);
            exposeCustomReportPage(conf);
            exposeAnalysisTrackingPage(conf);

        },
    };
}

function exposeRepositoryPage(conf: WebAppConfig): void {
    conf.express.get("/repository", ...conf.handlers, async (req, res, next) => {
        try {
            const workspaceId = req.query.workspaceId || "*";
            const id = req.query.id;
            const queryPath = req.query.path || "";
            const category = req.query.category || "*";

            const analysisResult = await conf.store.loadById(id, true, workspaceId);

            if (!analysisResult) {
                res.send(`No project at ${JSON.stringify(id)}`);
                return;
            }

            const everyFingerprint = await conf.store.fingerprintsForProject(workspaceId, id);
            const virtualPaths = _.uniq(everyFingerprint.map(f => f.path)).filter(p => !!p);
            const allFingerprints = everyFingerprint.filter(fp => fp.path === queryPath);
            // TODO this is nasty. why query deep in the first place?
            analysisResult.analysis.fingerprints = allFingerprints;

            const mostRecentTimestamp = allFingerprints.length > 0 ? new Date(Math.max(...allFingerprints.map(fp =>
                fp.timestamp.getTime()))) : undefined;
            const aspectsAndFingerprints = await projectFingerprints(conf.aspectRegistry,
                allFingerprints);

            const ffd: ProjectAspectForDisplay[] = aspectsAndFingerprints.map(aspectAndFingerprints => ({
                ...aspectAndFingerprints,
                fingerprints: aspectAndFingerprints.fingerprints.map(fp => ({
                    ...fp,
                    style: {},
                })),
            }));

            const repo = (await conf.aspectRegistry.tagAndScoreRepos(workspaceId, [analysisResult], { category }))[0];
            // TODO nasty
            repo.analysis.id.path = queryPath;
            res.send(renderStaticReactNode(
                RepoExplorer({
                    repo,
                    aspects: _.sortBy(ffd.filter(f => !!f.aspect.displayName), f => f.aspect.displayName),
                    category,
                    timestamp: mostRecentTimestamp,
                    virtualPaths,
                }), `Repository Insights`,
                conf.instanceMetadata));
            return;
        } catch (e) {
            logger.error(e);
            next(e);
        }
    });
}

function exposeExplorePage(conf: WebAppConfig): void {
    conf.express.get("/explore", ...conf.handlers, (req, res, next) => {
        const tags = req.query.tags || "";
        const workspaceId = req.query.workspaceId || "*";
        const dataUrl = `/api/v1/${workspaceId}/explore?tags=${tags}`;
        const readable = describeSelectedTagsToAnimals(tags.split(","));
        return renderDataUrl(conf.instanceMetadata, workspaceId, {
            dataUrl,
            heading: "Explore repositories by tag",
            title: `Repositories matching ${readable}`,
        },
            conf.aspectRegistry, conf.httpClientFactory, req, res).catch(next);
    });
}

function exposeDriftPage(conf: WebAppConfig): void {
    conf.express.get("/drift", ...conf.handlers, (req, res, next) => {
        const workspaceId = req.query.workspaceId || "*";
        const percentile = req.query.percentile || 0;
        const type = req.query.type;
        const dataUrl = `/api/v1/${workspaceId}/drift` +
            `?percentile=${percentile}` +
            (!!type ? `&type=${type}` : "");
        return renderDataUrl(conf.instanceMetadata, workspaceId, {
            dataUrl,
            title: "Drift by aspect",
            heading: type ?
                `Drift across aspect ${type} with entropy above ${percentile}th percentile` :
                `Drift across all aspects with entropy above ${percentile}th percentile`,
            subheading: "Sizing shows degree of entropy",
        },
            conf.aspectRegistry, conf.httpClientFactory, req, res).catch(next);
    });
}

function exposeFingerprintReportPage(conf: WebAppConfig): void {
    conf.express.get("/fingerprint/:type/:name", ...conf.handlers, (req, res, next) => {
        const type = req.params.type;
        const name = req.params.name;
        const aspect = conf.aspectRegistry.aspectOf(type);
        if (!aspect) {
            res.status(400).send("No aspect found for type " + type);
            return;
        }
        const fingerprintDisplayName = defaultedToDisplayableFingerprintName(aspect)(name);

        const workspaceId = req.query.workspaceId || "*";
        const dataUrl = `/api/v1/${workspaceId}/fingerprint/${
            encodeURIComponent(type)}/${
            encodeURIComponent(name)}?byOrg=${
            req.query.byOrg === "true"}&trim=${
            req.query.trim === "true"}`;
        renderDataUrl(conf.instanceMetadata, workspaceId, {
            dataUrl,
            title: `Atomist aspect drift`,
            heading: aspect.displayName,
            subheading: fingerprintDisplayName,
        }, conf.aspectRegistry, conf.httpClientFactory, req, res).catch(next);
    });
}

function exposeCustomReportPage(conf: WebAppConfig): void {
    conf.express.get("/report/:name", ...conf.handlers, (req, res, next) => {
        const name = req.params.name;
        const workspaceId = req.query.workspaceId || "*";
        const queryString = jsonToQueryString(req.query);
        const dataUrl = `/api/v1/${workspaceId}/report/${name}?${queryString}`;
        const reporter = CustomReporters[name];
        if (!reporter) {
            throw new Error(`No report named ${name}`);
        }
        return renderDataUrl(conf.instanceMetadata, workspaceId, {
            dataUrl,
            heading: name,
            title: reporter.summary,
        }, conf.aspectRegistry, conf.httpClientFactory, req, res).catch(next);
    });
}

// TODO fix any
async function renderDataUrl(instanceMetadata: ExtensionPackMetadata,
                             workspaceId: string,
                             page: {
        title: string,
        heading: string,
        subheading?: string,
        dataUrl: string,
    },
                             aspectRegistry: AspectRegistry,
                             httpClientFactory: HttpClientFactory,
                             req: any,
                             res: any): Promise<void> {
    let tree: TagTree;

    const fullUrl = `http://${req.get("host")}${page.dataUrl}`;
    try {
        const result = await httpClientFactory.create().exchange<TagTree>(fullUrl,
            { retry: { retries: 0 } });
        tree = result.body;
        logger.info("From %s, got %s", fullUrl, tree.circles.map(c => c.meaning));
    } catch (e) {
        throw new Error(`Failure fetching sunburst data from ${fullUrl}: ` + e.message);
    }

    populateLocalURLs(tree);

    logger.info("Data url=%s", page.dataUrl);

    const fieldsToDisplay = ["entropy", "variants", "count"];

    res.send(renderStaticReactNode(
        SunburstPage({
            workspaceId,
            heading: page.heading,
            subheading: page.subheading,
            query: req.params.query,
            dataUrl: fullUrl,
            tree,
            selectedTags: req.query.tags ? req.query.tags.split(",") : [],
            fieldsToDisplay,
        }),
        page.title,
        instanceMetadata,
        [
            "/sunburstScript-bundle.js",
        ]));
}

export function populateLocalURLs(plantedTree: PlantedTree): void {
    visit(plantedTree.tree, (n, level) => {
        const circle = plantedTree.circles[level];
        if (!circle) {
            return true;
        }
        const d = n as any;
        if (circle && circle.meaning === "aspect name") {
            if (d.type) {
                d.url = `/fingerprint/${encodeURIComponent(d.type)}/*`;
            }
        }
        if (d.fingerprint_name && d.type) {
            d.url = `/fingerprint/${encodeURIComponent(d.type)}/${encodeURIComponent(d.fingerprint_name)}`;
        }
        return true;
    });
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}

export type AugmentedFingerprintForDisplay =
    FP &
    Pick<ProjectFingerprintForDisplay, "displayValue" | "displayName">;

export interface AugmentedAspectForDisplay {
    aspect: Aspect;
    fingerprints: AugmentedFingerprintForDisplay[];
}

async function projectFingerprints(fm: AspectRegistry, allFingerprintsInOneProject: FP[]): Promise<AugmentedAspectForDisplay[]> {
    const result = [];
    for (const aspect of fm.aspects) {
        const originalFingerprints =
            _.sortBy(allFingerprintsInOneProject.filter(fp => aspect.name === (fp.type || fp.name)), fp => fp.name);
        if (originalFingerprints.length > 0) {
            const fingerprints: AugmentedFingerprintForDisplay[] = [];
            for (const fp of originalFingerprints) {
                fingerprints.push({
                    ...fp,
                    displayValue: defaultedToDisplayableFingerprint(aspect)(fp),
                    displayName: defaultedToDisplayableFingerprintName(aspect)(fp.name),
                });
            }
            result.push({
                aspect,
                fingerprints,
            });
        }
    }
    return result;
}
