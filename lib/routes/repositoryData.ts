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

import * as _ from "lodash";
import { logger } from "@atomist/automation-client";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { Express } from "express";
import { authHandlers, corsHandler } from "./auth";
import { average } from "../scorer/commonWorkspaceScorers";
import { FP } from "@atomist/sdm-pack-fingerprint";
import { VirtualProjectType } from "../aspect/common/virtualProjectAspect";

function isTagFingerprint(fp: FP): boolean {
    return fp.data.reason && fp.type !== VirtualProjectType;
}

// TODO if this is too inefficient we can query the database more specifically
export function exposeRepositoriesData(express: Express,
                                       store: ProjectAnalysisResultStore,
                                       secure: boolean): void {
    express.options("/api/v1/:workspace_id/repositories", corsHandler());
    express.get("/api/v1/:workspace_id/repositories", [corsHandler(), ...authHandlers(secure)],
        async (req, res, next) => {
            try {
                const workspaceId = req.params.workspace_id;

                const analysisResults = await store.loadInWorkspace(workspaceId, true);

                const results: any[] = [];
                for (const analysisResult of analysisResults) {
                    const fingerprints = await analysisResult.analysis.fingerprints;
                    const virtualPaths = _.uniq(fingerprints.map(f => f.path)).filter(p => !!p);

                    const tags = fingerprints.filter(isTagFingerprint)
                        .map(fp => ({ type: fp.type, name: fp.name }));
                    const scores = {};
                    const scoreFingerprints = fingerprints
                        .filter(fp => !fp.path)
                        .filter(fp => fp.data.weightedScore);
                    scoreFingerprints.forEach(fp => scores[fp.name] = fp.data);
                    const score = average(scoreFingerprints.map(sfp => sfp.data.weightedScore));
                    results.push({
                        id: analysisResult.id,
                        source: analysisResult.repoRef,
                        virtualPaths,
                        tags,
                        score,
                    })
                }

                const data = {
                    workspaceId,
                    results,
                };
                await res.send(data);

            } catch (e) {
                logger.error(e);
                next(e);
            }
        });
}

/**
 * Repository data endpoint
 * @param {e.Express} express
 * @param {ProjectAnalysisResultStore} store
 * @param {boolean} secure
 */
export function exposeRepositoryData(express: Express,
                                     store: ProjectAnalysisResultStore,
                                     secure: boolean): void {
    express.options("/api/v1/:workspace_id/repository", corsHandler());
    express.get("/api/v1/:workspace_id/repository", [corsHandler(), ...authHandlers(secure)],
        async (req, res, next) => {
            try {
                const workspaceId = req.params.workspace_id;
                const id = req.query.id;
                const path = req.query.path || "";

                const analysisResult = await store.loadById(id, true, workspaceId);
                if (!analysisResult) {
                    res.send(`No project at ${JSON.stringify(id)}`);
                    return;
                }

                const allFingerprints = await analysisResult.analysis.fingerprints;
                const virtualPaths = _.uniq(allFingerprints.map(f => f.path)).filter(p => !!p);
                const relevantFingerprints = allFingerprints.filter(fp => fp.path === path);
                const tags = relevantFingerprints.filter(isTagFingerprint)
                    .map(fp => ({ type: fp.type, name: fp.name }));
                const scores = {};
                const scoreFingerprints = relevantFingerprints.filter(fp => fp.data.weightedScore);
                scoreFingerprints.forEach(fp => scores[fp.name] = fp.data);
                const score = average(scoreFingerprints.map(sfp => sfp.data.weightedScore));

                const data = {
                    workspaceId,
                    id,
                    source: analysisResult.repoRef,
                    path,
                    virtualPaths,
                    allFingerprints,
                    relevantFingerprints,
                    tags,
                    scores,
                    score,
                };
                await res.send(data);

            } catch (e) {
                logger.error(e);
                next(e);
            }
        });
}
