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

/* tslint:disable:max-file-line-count */

import { logger } from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import { isInLocalMode } from "@atomist/sdm-core";
import {
    Aspect,
} from "@atomist/sdm-pack-fingerprint";
import * as bodyParser from "body-parser";
import {
    Express,
    Request,
    RequestHandler,
    Response,
} from "express";
import * as _ from "lodash";
import * as path from "path";
import * as swaggerUi from "swagger-ui-express";
import * as yaml from "yamljs";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../analysis/offline/spider/analytics";
import {
    AspectRegistry,
    ScoredRepo,
} from "../aspect/AspectRegistry";
import { AspectReportDetailsRegistry } from "../aspect/AspectReportDetailsRegistry";
import { CustomReporters } from "../customize/customReporters";
import {
    isSunburstTree,
    PlantedTree,
    SunburstTree,
    TagUsage,
} from "../tree/sunburst";
import {
    introduceClassificationLayer,
    killChildren,
    trimOuterRim,
    visit,
} from "../tree/treeUtils";
import {
    BandCasing,
    bandFor,
} from "../util/bands";
import { EntropySizeBands } from "../util/commonBands";

import { Omit } from "../util/omit";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import { buildFingerprintTree } from "./buildFingerprintTree";
import { getAspectReports } from "./categories";
import {
    exposeRepositoriesData,
    exposeRepositoryData,
} from "./repositoryData";
import { tagUsageIn } from "./support/tagUtils";
import {
    addRepositoryViewUrl,
    splitByOrg,
} from "./support/treeMunging";

/**
 * Expose the public API routes, returning JSON.
 * Also expose Swagger API documentation.
 */
export function api(projectAnalysisResultStore: ProjectAnalysisResultStore,
    aspectRegistry: AspectRegistry & AspectReportDetailsRegistry,
    secure: boolean): {
        customizer: ExpressCustomizer,
        routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    } {
    const serveSwagger = isInLocalMode();
    const docRoute = "/api-docs";
    const routesToSuggestOnStartup = serveSwagger ? [{ title: "Swagger", route: docRoute }] : [];
    return {
        routesToSuggestOnStartup,
        customizer: (express: Express, ...handlers: RequestHandler[]) => {
            express.use(bodyParser.json());       // to support JSON-encoded bodies
            express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
                extended: true,
            }));

            if (serveSwagger) {
                exposeSwaggerDoc(express, docRoute);
            }

            configureAuth(express);

            exposeAspectMetadata(express, projectAnalysisResultStore, aspectRegistry, secure);
            exposeListTags(express, projectAnalysisResultStore, secure);
            exposeListFingerprints(express, projectAnalysisResultStore, secure);
            exposeRepositoriesData(express, projectAnalysisResultStore, secure);
            exposeRepositoryData(express, projectAnalysisResultStore, secure);
            exposeFingerprintByType(express, aspectRegistry, projectAnalysisResultStore, secure);
            exposeExplore(express, aspectRegistry, projectAnalysisResultStore, secure);
            exposeFingerprintByTypeAndName(express, aspectRegistry, projectAnalysisResultStore, secure);
            exposeDrift(express, aspectRegistry, projectAnalysisResultStore, secure);
            exposeCustomReports(express, projectAnalysisResultStore, secure);
            exposePersistEntropy(express, projectAnalysisResultStore, handlers, secure);

            express.use((err, req, res, next) => {
                if (res.headersSent) {
                    return next(err);
                }
                res.status(500);
                res.json({ message: err.message });
            });
        },
    };
}

function exposeSwaggerDoc(express: Express, docRoute: string): void {
    const swaggerDocPath = path.join(__dirname, "..", "..", "swagger.yaml");
    const swaggerDocument = yaml.load(swaggerDocPath);
    express.use(docRoute, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

function exposeAspectMetadata(express: Express,
    store: ProjectAnalysisResultStore,
    aspectRegistry: AspectRegistry & AspectReportDetailsRegistry,
    secure: boolean): void {
    // Return the aspects metadata
    express.options("/api/v1/:workspace_id/aspects", corsHandler());
    express.get("/api/v1/:workspace_id/aspects", [corsHandler(), ...authHandlers(secure)], async (req, res, next) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintKinds = await store.distinctRepoFingerprintKinds(workspaceId);
            const fingerprintUsage = await store.fingerprintUsageForType(workspaceId);
            const reports = await getAspectReports(fingerprintKinds as any, fingerprintUsage, aspectRegistry, workspaceId);
            logger.debug("Returning aspect reports for '%s': %j", workspaceId, reports);
            const count = await store.distinctRepoCount(workspaceId);
            const at = await store.latestTimestamp(workspaceId);

            res.json({
                list: reports,
                analyzed: {
                    repo_count: count,
                    at,
                },
            });
        } catch (e) {
            logger.warn("Error occurred getting aspect metadata: %s %s", e.message, e.stack);
            next(e);
        }
    });
}

/**
 * Expose all fingerprints in workspace
 * @param {e.Express} express
 * @param {ProjectAnalysisResultStore} store
 * @param {boolean} secure
 */
function exposeListFingerprints(express: Express, store: ProjectAnalysisResultStore, secure: boolean): void {
    // Return all fingerprints
    express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprints", [corsHandler(), ...authHandlers(secure)], (req, res, next) =>
        store.fingerprintUsageForType(req.params.workspace_id || "local").then(fingerprintUsage => {
            logger.debug("Returning fingerprints: %j", fingerprintUsage);
            res.json({ list: fingerprintUsage });
        }, next));
}

function exposeListTags(express: Express, store: ProjectAnalysisResultStore, secure: boolean): void {
    express.options("/api/v1/:workspace_id/tags", corsHandler());
    express.get("/api/v1/:workspace_id/tags", [corsHandler(), ...authHandlers(secure)], (req, res, next) =>
        store.tags(req.params.workspace_id || "local").then(tags => {
            logger.debug("Returning tags: %j", tags);
            res.json({ list: tags });
        }, next));
}

function exposeFingerprintByType(express: Express,
    aspectRegistry: AspectRegistry,
    store: ProjectAnalysisResultStore,
    secure: boolean): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers(secure)], async (req, res, next) => {
        try {
            const workspaceId = req.params.workspace_id || "*";
            const type = req.params.type;
            const fps: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId, type);
            fillInAspectNamesInList(aspectRegistry, fps);
            logger.debug("Returning fingerprints of type for '%s': %j", workspaceId, fps);
            res.json({
                list: fps,
                analyzed: {
                    count: fps.length,
                    variants: _.sumBy(fps, "variants"),
                },
            });
        } catch (e) {
            logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
            next(e);
        }
    });
}

function exposeFingerprintByTypeAndName(express: Express,
    aspectRegistry: AspectRegistry,
    store: ProjectAnalysisResultStore,
    secure: boolean): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type/:name", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type/:name", [corsHandler(), ...authHandlers(secure)],
        async (req: Request, res: Response, next) => {
            const workspaceId = req.params.workspace_id;
            const fingerprintType = req.params.type;
            const fingerprintName = req.params.name;
            const byName = req.params.name !== "*";
            const trim = req.query.trim === "true";
            const byOrg = req.query.byOrg === "true";

            try {
                const pt = await buildFingerprintTree({ aspectRegistry, store }, {
                    byOrg,
                    trim,
                    fingerprintType,
                    fingerprintName,
                    workspaceId,
                    byName,
                });

                res.json(pt);
            } catch (e) {
                logger.warn("Error occurred getting one fingerprint: %s %s", e.message, e.stack);
                next(e);
            }
        });
}

/**
 * Drift report, sizing aspects and fingerprints by entropy
 */
function exposeDrift(express: Express, aspectRegistry: AspectRegistry, store: ProjectAnalysisResultStore, secure: boolean): void {
    express.options("/api/v1/:workspace_id/drift", corsHandler());
    express.get("/api/v1/:workspace_id/drift", [corsHandler(), ...authHandlers(secure)], async (req, res, next) => {
        try {
            const type = req.query.type;
            const band = req.query.band === "true";
            const repos = req.query.repos === "true";
            const percentile: number = req.query.percentile ? parseFloat(req.query.percentile) : 0;
            logger.info("Entropy query: query.percentile='%s', percentile=%d, type=%s",
                req.query.percentile, percentile, type);

            let driftTree = await store.aspectDriftTree(req.params.workspace_id, percentile, { repos, type });
            fillInAspectNames(aspectRegistry, driftTree.tree);
            if (!type) {
                driftTree = removeAspectsWithoutMeaningfulEntropy(aspectRegistry, driftTree);
            }
            if (band) {
                driftTree = introduceClassificationLayer(driftTree, {
                    newLayerMeaning: "entropy band",
                    newLayerDepth: 1,
                    descendantClassifier: fp => {
                        if (!!(fp as any).entropy) {
                            return bandFor(EntropySizeBands, (fp as any).entropy, {
                                casing: BandCasing.Sentence,
                                includeNumber: false,
                            });
                        } else {
                            return undefined;
                        }
                    },
                });
            }
            // driftTree.tree = flattenSoleFingerprints(driftTree.tree);
            fillInDriftTreeAspectNames(aspectRegistry, driftTree.tree);
            return res.json(driftTree);
        } catch (err) {
            logger.warn("Error occurred getting drift report: %s %s", err.message, err.stack);
            next(err);
        }
    });
}

/**
 * Explore by tags
 */
function exposeExplore(express: Express, aspectRegistry: AspectRegistry, store: ProjectAnalysisResultStore, secure: boolean): void {
    express.options("/api/v1/:workspace_id/explore", corsHandler());
    express.get("/api/v1/:workspace_id/explore", [corsHandler(), ...authHandlers(secure)], async (req, res, next) => {
        try {
            const workspaceId = req.params.workspace_id || "*";
            const repos = await store.loadInWorkspace(workspaceId, true);
            const selectedTags: string[] = req.query.tags ? req.query.tags.split(",") : [];
            const category = req.query.category;

            const taggedRepos = await aspectRegistry.tagAndScoreRepos(workspaceId, repos, { category });

            const relevantRepos = taggedRepos.filter(repo => selectedTags.every(tag => relevant(tag, repo)));
            logger.info("Found %d relevant repos of %d", relevantRepos.length, repos.length);

            const allTags = tagUsageIn(aspectRegistry, relevantRepos);
            // await store.tags(workspaceId)

            let repoTree: PlantedTree = {
                circles: [{ meaning: "tag filter" }, { meaning: "repo" }],
                tree: {
                    name: describeSelectedTagsToAnimals(selectedTags),
                    children: relevantRepos.map(r => {
                        return {
                            id: r.id,
                            owner: r.analysis.id.owner,
                            repo: r.analysis.id.repo,
                            name: r.analysis.id.repo,
                            url: r.analysis.id.url,
                            size: r.analysis.fingerprints.length,
                            tags: r.tags,
                            weightedScore: r.weightedScore,
                        };
                    }),
                },
            };

            if (req.query.byOrg !== "false") {
                repoTree = splitByOrg(repoTree);
            }
            repoTree.tree = addRepositoryViewUrl(repoTree.tree);

            const tagTree: TagTree = {
                tags: allTags,
                selectedTags,
                repoCount: repos.length,
                matchingRepoCount: relevantRepos.length,
                ...repoTree,
                workspaceId,
            };
            res.send(tagTree);
        } catch (err) {
            next(err);
        }
    });
}

export interface TagContext {

    /**
     * All repos available
     */
    repoCount: number;

    workspaceId: string;

    aspectRegistry: AspectRegistry;
}

export interface TagTree extends Omit<TagContext, "aspectRegistry">, PlantedTree {
    matchingRepoCount: number;
    tags: TagUsage[];
    selectedTags: string[];
}

/**
 * Any nodes that have type and name should be given the fingerprint name from the aspect if possible
 */
function fillInAspectNames(aspectRegistry: AspectRegistry, tree: SunburstTree): void {
    visit(tree, n => {
        const t = n as any;
        if (t.name && t.type) {
            if (t.name && t.type) {
                const aspect = aspectRegistry.aspectOf(t.type);
                if (aspect) {
                    if (aspect.toDisplayableFingerprintName) {
                        n.name = aspect.toDisplayableFingerprintName(n.name);
                    }
                }
            }
        }
        return true;
    });
}

/**
 * If the aspect says entropy isn't significant, reduce it.
 */

/**
 * If the aspect says entropy isn't significant, reduce it.
 */
function removeAspectsWithoutMeaningfulEntropy(aspectRegistry: AspectRegistry, driftTree: PlantedTree): PlantedTree {
    driftTree.tree = killChildren(driftTree.tree, child => {
        if (isSunburstTree(child)) {
            return false;
        }
        const t = child as any;
        if (t.type) {
            const aspect = aspectRegistry.aspectOf(t.type);
            return aspectSpecifiesNoEntropy(aspect);
        }
        return false;
    });
    return driftTree;
}

export function aspectSpecifiesNoEntropy(aspect: Aspect<any> | undefined): boolean {
    return !!aspect && !!aspect.stats && aspect.stats.defaultStatStatus.entropy === false;
}

function flattenSoleFingerprints(tree: SunburstTree): SunburstTree {
    // Remove anything where entropy isn't meaningful
    return trimOuterRim(tree, container => container.children.length === 1);
}

/**
 * Fill in aspect names
 */
function fillInAspectNamesInList(aspectRegistry: AspectRegistry, fingerprints: FingerprintUsage[]): void {
    fingerprints.forEach(fp => {
        const aspect = aspectRegistry.aspectOf(fp.type);
        if (!!aspect && !!aspect.toDisplayableFingerprintName) {
            (fp as any).displayName = aspect.toDisplayableFingerprintName(fp.name);
        }
        // This is going to be needed for the invocation of the command handlers to set targets
        (fp as any).fingerprint = `${fp.type}::${fp.name}`;
    });
}

function fillInDriftTreeAspectNames(aspectRegistry: AspectRegistry, driftTree: SunburstTree): void {
    visit(driftTree, (n, depth) => {
        if (depth === 2) {
            const aspect = aspectRegistry.aspectOf(n.name);
            if (aspect && aspect.displayName) {
                n.name = aspect.displayName;
            }
        }
        return true;
    });
}

function exposeCustomReports(express: Express, store: ProjectAnalysisResultStore, secure: boolean): void {
    // In memory queries against returns
    express.options("/api/v1/:workspace_id/report/:name", corsHandler());
    express.get("/api/v1/:workspace_id/report/:name", [corsHandler(), ...authHandlers(secure)], async (req, res, next) => {
        try {
            const q = CustomReporters[req.params.name];
            if (!q) {
                throw new Error(`No report named '${req.params.name}'`);
            }

            const repos = await store.loadInWorkspace(req.query.workspace || req.params.workspace_id, true);
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            let pt = await q.builder.toPlantedTree(() => relevantRepos.map(r => r.analysis));
            if (req.query.byOrg !== "false") {
                pt = splitByOrg(pt);
            }
            return res.json(pt);
        } catch (e) {
            logger.warn("Error occurred getting report: %s %s", e.message, e.stack);
            next(e);
        }
    });
}

function exposePersistEntropy(express: Express, store: ProjectAnalysisResultStore, handlers: RequestHandler[], secure: boolean): void {
    // Calculate and persist entropy for this fingerprint
    express.options("/api/v1/:workspace_id/entropy/:type/:name", corsHandler());
    express.put("/api/v1/:workspace_id/entropy/:type/:name", [corsHandler(), ...authHandlers(secure)], async (req, res, next) =>
        computeAnalyticsForFingerprintKind(store, req.params.workspace_id, req.params.type, req.params.name).then(() => res.sendStatus(201), next));
}

function relevant(selectedTag: string, repo: ScoredRepo): boolean {
    const repoTags = (repo.tags || []).map(tag => tag.name);
    return selectedTag.startsWith("!") ? !repoTags.includes(selectedTag.substr(1)) : repoTags.includes(selectedTag);
}

export function describeSelectedTagsToAnimals(selectedTags: string[]): string {
    return selectedTags.map(t => t.replace("!", "not ")).join(" and ") || "All";
}
