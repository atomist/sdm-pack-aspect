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
    RepoForDisplay,
    RepoList,
} from "../../../views/repoList";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { WebAppConfig } from "./webAppConfig";

export type SortOrder = "name" | "score";

/**
 * Takes sortOrder optional parameter to dictate sorting
 */
export function exposeRepositoryListPage(conf: WebAppConfig): void {
    conf.express.get("/repositories", ...conf.handlers, async (req, res, next) => {
        try {
            const workspaceId = req.query.workspace || req.params.workspace_id || "local";
            const sortOrder: SortOrder = req.query.sortOrder || "score";
            const byOrg = req.query.byOrg !== "false";
            const category = req.query.category || "*";

            const allAnalysisResults = await conf.store.loadInWorkspace(workspaceId, true);

            // optional query parameter: owner
            const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
            if (relevantAnalysisResults.length === 0) {
                res.send(`No matching repos for organization ${req.query.owner}`);
                return;
            }

            const relevantRepos = await conf.aspectRegistry.tagAndScoreRepos(workspaceId, relevantAnalysisResults, { category });
            const repos: RepoForDisplay[] = relevantRepos
                .map(ar => ({
                    url: ar.analysis.id.url,
                    repo: ar.analysis.id.repo,
                    owner: ar.analysis.id.owner,
                    id: ar.id,
                    score: ar.weightedScore.weightedScore,
                    showFullPath: !byOrg,
                }));
            const virtualProjectCount = await conf.store.virtualProjectCount(workspaceId);

            const fingerprintUsage = await conf.store.fingerprintUsageForType(workspaceId);

            const orgScore = await conf.aspectRegistry.scoreWorkspace(workspaceId, { fingerprintUsage, repos });
            res.send(renderStaticReactNode(
                RepoList({
                    orgScore,
                    repos,
                    virtualProjectCount,
                    sortOrder,
                    byOrg,
                    expand: !byOrg,
                    category,
                }),
                byOrg ? "Repositories by Organization" : "Repositories Ranked",
                conf.instanceMetadata));
            return;
        } catch (e) {
            next(e);
        }
    });
}
