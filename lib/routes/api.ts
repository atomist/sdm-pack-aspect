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
    automationClientInstance,
    logger,
    QueryNoCacheOptions,
} from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import { isInLocalMode } from "@atomist/sdm-core";
import { toName } from "@atomist/sdm-pack-fingerprints/lib/adhoc/preferences";
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
    ClientFactory,
} from "../analysis/offline/persist/pgUtils";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
    whereFor,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../analysis/offline/spider/analytics";
import { AspectRegistry } from "../aspect/AspectRegistry";
import {
    driftTree,
    driftTreeForSingleAspect,
} from "../aspect/repoTree";
import { getAspectReports } from "../customize/categories";
import { SunburstTree } from "../tree/sunburst";
import { visit } from "../tree/treeUtils";
import { GetFpTargets } from "../typings/types";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import { buildFingerprintTree } from "./buildFingerprintTree";
import { WellKnownReporters } from "./wellKnownReporters";

/**
 * Expose the public API routes, returning JSON.
 * Also expose Swagger API documentation.
 */
export function api(clientFactory: ClientFactory,
                    store: ProjectAnalysisResultStore,
                    aspectRegistry: AspectRegistry): {
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

            exposeIdealAndProblemSetting(express, aspectRegistry);

            exposeAspectMetadata(express, store);

            exposeListFingerprints(express, store);

            exposeFingerprintByType(express, aspectRegistry, store);

            exposeFingerprintByTypeAndName(express, aspectRegistry, clientFactory);

            exposeDrift(express, aspectRegistry, clientFactory);

            // In memory queries against returns
            express.options("/api/v1/:workspace_id/filter/:name", corsHandler());
            express.get("/api/v1/:workspace_id/filter/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
                try {
                    const allQueries = WellKnownReporters;
                    const q = allQueries[req.params.name];
                    if (!q) {
                        throw new Error(`No query named '${req.params.name}'`);
                    }

                    const cannedQuery = q({
                        ...req.query,
                    });

                    const repos = await store.loadWhere(whereFor(req.query.workspace, req.params.workspace_id));
                    const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
                    const data = await cannedQuery.toSunburstTree(() => relevantRepos.map(r => r.analysis));
                    return res.json({ tree: data });
                } catch (e) {
                    logger.warn("Error occurred getting report: %s %s", e.message, e.stack);
                    res.sendStatus(500);
                }
            });

            // Calculate and persist entropy for this fingerprint
            express.put("/api/v1/:workspace/entropy/:type/:name", ...handlers, async (req, res) => {
                await computeAnalyticsForFingerprintKind(store, req.params.workspace, req.params.type, req.params.name);
                res.sendStatus(201);
            });
        },
    };
}

function exposeSwaggerDoc(express: Express, docRoute: string): void {
    const swaggerDocPath = path.join(__dirname, "..", "..", "swagger.yaml");
    const swaggerDocument = yaml.load(swaggerDocPath);
    express.use(docRoute, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

function exposeAspectMetadata(express: Express, store: ProjectAnalysisResultStore): void {
    // Return the aspects metadata
    express.options("/api/v1/:workspace_id/aspects", corsHandler());
    express.get("/api/v1/:workspace_id/aspects", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
            const reports = getAspectReports(fingerprintUsage, workspaceId);
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
            res.sendStatus(500);
        }
    });
}

function exposeListFingerprints(express: Express, store: ProjectAnalysisResultStore): void {
    // Return all fingerprints
    express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprints", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
            logger.debug("Returning fingerprints for '%s': %j", workspaceId, fingerprintUsage);
            res.json({ list: fingerprintUsage });
        } catch (e) {
            logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeFingerprintByType(express: Express,
                                 aspectRegistry: AspectRegistry,
                                 store: ProjectAnalysisResultStore): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers()], async (req, res) => {
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
            res.sendStatus(500);
        }
    });
}

function exposeFingerprintByTypeAndName(express: Express,
                                        aspectRegistry: AspectRegistry,
                                        clientFactory: ClientFactory): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type/:name", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type/:name", [corsHandler(), ...authHandlers()], async (req: Request, res: Response) => {
        const workspaceId = req.params.workspace_id;
        const fingerprintType = req.params.type;
        const fingerprintName = req.params.name;
        const byName = req.params.name !== "*";
        const showPresence = req.query.presence === "true";
        const showProgress = req.query.progress === "true";
        const trim = req.query.trim === "true";
        const byOrg = req.query.byOrg === "true";
        const otherLabel = req.query.otherLabel === "true";

        try {
            const pt = await buildFingerprintTree({ aspectRegistry, clientFactory }, {
                showPresence,
                otherLabel,
                showProgress,
                byOrg,
                trim,
                fingerprintType,
                fingerprintName,
                workspaceId,
                byName,
            });

            res.json({
                ...pt,
                target: await getFingerprintTarget(req, aspectRegistry, fingerprintType, fingerprintName, workspaceId),
            });
        } catch (e) {
            logger.warn("Error occurred getting one fingerprint: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeDrift(express: Express, aspectRegistry: AspectRegistry, clientFactory: ClientFactory): void {
    express.options("/api/v1/:workspace_id/drift", corsHandler());
    express.get("/api/v1/:workspace_id/drift", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const type = req.query.type;
                const skewTree = type ?
                    await driftTreeForSingleAspect(req.params.workspace_id, type, clientFactory) :
                    await driftTree(req.params.workspace_id, clientFactory);
                fillInAspectNames(aspectRegistry, skewTree.tree);
                return res.json(skewTree);
            } catch
                (err) {
                logger.warn("Error occurred getting drift report: %s %s", err.message, err.stack);
                res.sendStatus(500);
            }
        },
    );
}

function exposeIdealAndProblemSetting(express: Express, aspectRegistry: AspectRegistry): void {
    // Set an ideal
    express.options("/api/v1/:workspace_id/ideal/:id", corsHandler());
    express.put("/api/v1/:workspace_id/ideal/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
        await aspectRegistry.idealStore.setIdeal(req.params.workspace_id, req.params.id);
        logger.info(`Set ideal to ${req.params.id}`);
        res.sendStatus(201);
    });

    // Note this fingerprint as a problem
    express.options("/api/v1/:workspace_id/problem/:id", corsHandler());
    express.put("/api/v1/:workspace_id/problem/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
        await aspectRegistry.problemStore.noteProblem(req.params.workspace_id, req.params.id);
        logger.info(`Set problem at ${req.params.id}`);
        res.sendStatus(201);
    });
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
                if (aspect && aspect.toDisplayableFingerprintName) {
                    n.name = aspect.toDisplayableFingerprintName(n.name);
                }
            }
        }
        return true;
    });
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

/**
 * Get the target for a single type and name
 */
async function getFingerprintTarget(req: Request,
                                    aspectRegistry: AspectRegistry,
                                    type: string,
                                    name: string,
                                    workspaceId: string): Promise<{ type: string, name: string, value: string, sha: string, data: any }> {

    // TODO cd Once the ideals_fingerprints table is populated from the backend, we'll move to reading that

    if (isInLocalMode()) {
        return undefined;
    }

    let creds;
    if (!!req.cookies && !!req.cookies.access_token) {
        creds = req.cookies.access_token;
    } else {
        creds = (req as any).authorization.credentials;
    }

    if (!!creds) {
        const configuration = automationClientInstance().configuration;
        const graphClient = configuration.graphql.client.factory.create(
            workspaceId,
            {
                ...configuration,
                apiKey: creds,
            });
        const targets = await graphClient.query<GetFpTargets.Query, GetFpTargets.Variables>({
            name: "GetFpTargets",
            options: QueryNoCacheOptions,
        });
        const fingerprint = toName(type, name);
        const target = (targets.TeamConfiguration || []).find(fp => fp.name === fingerprint);
        if (!!target) {
            const value = JSON.parse(target.value);
            const aspect = aspectRegistry.aspectOf(type);
            let displayValue;
            if (!!aspect && !!aspect.toDisplayableFingerprint) {
                displayValue = aspect.toDisplayableFingerprint({
                    name,
                    type,
                    data: value.data,
                    sha: value.sha,
                });
            }
            return {
                type,
                name,
                sha: value.sha,
                data: value.data,
                value: displayValue,
            };
        }
    }

    return undefined;
}
