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

import { logger } from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import { FP } from "@atomist/sdm-pack-fingerprints";
import { BaseFeature } from "@atomist/sdm-pack-fingerprints/lib/machine/Feature";
import { isConcreteIdeal } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import * as bodyParser from "body-parser";
import {
    Express,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import { ClientFactory } from "../analysis/offline/persist/pgUtils";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../analysis/offline/spider/analytics";
import { AspectRegistry } from "../feature/AspectRegistry";
import { reportersAgainst } from "../feature/reportersAgainst";
import {
    fingerprintsChildrenQuery,
    repoTree,
} from "../feature/repoTree";
import {
    descendants,
    mergeSiblings,
    splitBy,
    SunburstTree,
    visit,
} from "../tree/sunburst";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import { whereFor } from "./orgPage";
import {
    featureReport,
    skewReport,
    WellKnownReporters,
} from "./wellKnownReporters";

/**
 * Public API routes, returning JSON
 */
export function api(clientFactory: ClientFactory,
                    store: ProjectAnalysisResultStore,
                    aspectRegistry: AspectRegistry): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {

        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        configureAuth(express);

        express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
        express.put("/api/v1/:workspace_id/ideal/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
            await aspectRegistry.idealStore.setIdeal(req.params.workspace_id, req.params.id);
            logger.info(`Set ideal to ${req.params.id}`);
            res.sendStatus(201);
        });

        // Return all fingerprints
        express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprints", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const workspaceId = req.params.workspace_id || "local";
                const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
                logger.debug("Returning fingerprints for '%s': %j", workspaceId, fingerprintUsage);
                res.json(fingerprintUsage);
            } catch (e) {
                logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const workspaceId = req.params.workspace_id || "local";
                const fps = await store.fingerprintUsageForType(workspaceId, req.params.type);
                logger.debug("Returning fingerprints of type for '%s': %j", workspaceId, fps);
                res.json(fps);
            } catch (e) {
                logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        /* the d3 sunburst on the /query page uses this */
        express.options("/api/v1/:workspace_id/fingerprint/:type/:name", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprint/:type/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
            const byName = req.params.name !== "*";
            let workspaceId = req.params.workspace_id;
            if (workspaceId === "*") {
                workspaceId = "local";
            }
            try {
                const tree = await repoTree({
                    workspaceId,
                    clientFactory,
                    query: fingerprintsChildrenQuery(byName, req.query.otherLabel === "true"),
                    rootName: req.params.name,
                    featureName: req.params.type,
                });
                logger.debug("Returning fingerprint '%s': %j", req.params.name, tree);
                if (!byName) {
                    splitBy<{ data: any, type: string }>(tree,
                        l => {
                            const aspect: BaseFeature = aspectRegistry.aspectOf(l.type);
                            if (!aspect || !aspect.toDisplayableFingerprintName) {
                                return l.name;
                            }
                            return aspect.toDisplayableFingerprintName(l.name);
                        },
                        0,
                        l => descendants(l).filter(n => !!_.get(n, "sha")));
                }
                resolveAspectNames(aspectRegistry, tree);
                if (req.query.byOrg === "true") {
                    splitBy<{ owner: string }>(tree, l => l.owner, 0);
                } else if (req.query.byThing) {
                    splitBy<{ owner: string }>(tree, l => l.owner, 1);
                }
                if (req.query.presence === "true") {
                    mergeSiblings(tree,
                        parent => parent.children.some(c => (c as any).sha),
                        kid => (kid as any).sha ? "Yes" : "No");
                } else if (req.query.progress === "true") {
                    const ideal = await aspectRegistry.idealStore.loadIdeal(workspaceId, req.params.type, req.params.name);
                    if (!ideal || !isConcreteIdeal(ideal)) {
                        throw new Error(`No ideal to aspire to for ${req.params.type}/${req.params.name}`);
                    }
                    mergeSiblings(tree,
                        parent => parent.children.some(c => (c as any).sha),
                        kid => (kid as any).sha === ideal.ideal.sha ? "Ideal" : "No");
                }

                res.json(tree);
            } catch (e) {
                logger.warn("Error occurred getting one fingerprint: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        // In memory queries against returns
        express.options("/api/v1/:workspace_id/filter/:name", corsHandler());
        express.get("/api/v1/:workspace_id/filter/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                if (req.params.name === "skew") {
                    const fingerprintUsage = await store.fingerprintUsageForType(req.params.workspace_id);
                    logger.info("Found %d fingerprint kinds used", fingerprintUsage.length);
                    const skewTree = await skewReport(aspectRegistry).toSunburstTree(
                        () => fingerprintUsage);
                    return res.json(skewTree);
                }

                if (req.params.name === "featureReport") {
                    const type = req.query.type;
                    const fingerprints = await store.fingerprintsInWorkspace(req.params.workspace_id, type);
                    const withDups = await store.fingerprintsInWorkspace(req.params.workspace_id, type, undefined, true);
                    logger.info("Found %d fingerprints", fingerprints.length);
                    const featureTree = await featureReport(type, aspectRegistry, withDups).toSunburstTree(
                        () => fingerprints);
                    return res.json(featureTree);
                }

                const featureQueries = await reportersAgainst(
                    () => store.distinctFingerprintKinds(req.params.workspace_id), aspectRegistry);
                const allQueries = _.merge(featureQueries, WellKnownReporters);

                const cannedQuery = allQueries[req.params.name]({
                    ...req.query,
                });

                const repos = await store.loadWhere(whereFor(req));
                const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
                const data = await cannedQuery.toSunburstTree(() => relevantRepos.map(r => r.analysis));
                return res.json(data);
            } catch (e) {
                logger.warn("Error occurred getting fingerprint: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        // Calculate and persist entropy for this fingerprint
        express.put("/api/v1/:workspace/entropy/:type/:name", ...handlers, async (req, res) => {
            await computeAnalyticsForFingerprintKind(store, req.params.workspace, req.params.type, req.params.name);
            res.sendStatus(201);
        });
    };
}

function resolveAspectNames(fm: AspectRegistry, t: SunburstTree): void {
    visit(t, l => {
        if ((l as any).sha) {
            const fp = l as any as FP;
            // It's a fingerprint name
            const aspect = fm.aspectOf(fp.type);
            if (aspect) {
                fp.name = aspect.toDisplayableFingerprint ? aspect.toDisplayableFingerprint(fp) : fp.data;
            }
        }
        return true;
    });
}
