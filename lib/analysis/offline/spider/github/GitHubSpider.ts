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
    GitProject,
    logger,
} from "@atomist/automation-client";
import * as Octokit from "@octokit/rest";
import * as _ from "lodash";
import { AnalysisRun } from "../common";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Analyzer,
    PersistenceResult,
    Spider,
    SpiderFailure,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

/**
 * Implementating this allows control over cloning
 */
export interface Cloner {

    clone(sourceData: GitHubSearchResult): Promise<GitProject>;
}

/**
 * Spider GitHub. Ensure that GITHUB_TOKEN environment variable is set.
 */
export class GitHubSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: Analyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {

        const run = new AnalysisRun<GitHubSearchResult>({
            howToFindRepos: () => this.queryFunction(process.env.GITHUB_TOKEN, criteria),
            determineRepoRef: sourceData => Promise.resolve({
                owner: sourceData.owner.login,
                repo: sourceData.name,
                url: sourceData.url,
            }),
            describeFoundRepo: sourceData => sourceData.html_url,
            howToClone: async (rr, sourceData) => {
                const p = await this.cloner.clone(sourceData);
                rr.sha = p.id.sha; // very sneaky. We don't have it sooner. Hopefully this is soon enough.
                return p;
            },
            analyzer,
            persister: opts.persister,
            keepExistingPersisted: opts.keepExistingPersisted,
            projectFilter: criteria.projectTest,

        }, {
                workspaceId: opts.workspaceId,
                description: "querying GitHub: " + criteria.githubQueries.join(" and "),
                maxRepos: 1000,
                poolSize: opts.poolSize || 40,
            });

        return run.run();
    }

    public constructor(
        private readonly cloner: Cloner,
        private readonly queryFunction: (token: string, criteria: ScmSearchCriteria)
            => AsyncIterable<GitHubSearchResult>
            = queryByCriteria) {
    }

}

function dropIrrelevantFields(sourceData: GitHubSearchResult): GitHubSearchResult {
    return {
        owner: { login: sourceData.owner.login },
        name: sourceData.name,
        url: sourceData.url,
        html_url: sourceData.html_url,
        timestamp: sourceData.timestamp,
        query: sourceData.query,
    };
}

export interface AnalyzeResult {
    failedToCloneOrAnalyze: SpiderFailure[];
    repoCount: number;
    projectCount: number;
    millisTaken: number;
}

export interface AnalyzeAndPersistResult extends AnalyzeResult {
    failedToPersist: SpiderFailure[];
    persisted: PersistenceResult[];
}

/**
 * Result row in a GitHub search
 */
export interface GitHubSearchResult {
    owner: { login: string };
    name: string;
    url: string;
    html_url: string;
    timestamp: Date;
    query: string;
}

async function* queryByCriteria(token: string, criteria: ScmSearchCriteria): AsyncIterable<GitHubSearchResult> {
    const octokit = new Octokit({
        auth: token ? "token " + token : undefined,
        baseUrl: "https://api.github.com",
    });
    let results: any[] = [];
    let retrieved = 0;
    for (const q of criteria.githubQueries) {
        logger.debug("Running query " + q + "...");
        const options = octokit.search.repos.endpoint.merge({ q });
        for await (const response of octokit.paginate.iterator(options)) {
            retrieved += response.data.length;
            const newResults = response.data
                .filter((r: any) => !results.some(existing => existing.full_name === r.full_name));
            newResults.forEach((r: any) => {
                r.query = q;
                r.timestamp = new Date();
            });
            for (const newResult of newResults) {
                yield dropIrrelevantFields(newResult);
            }
            logger.debug(`Looked at ${retrieved} repos of max ${criteria.maxRetrieved}...`);
            if (retrieved > criteria.maxRetrieved) {
                break;
            }
            if (results.length > criteria.maxReturned) {
                results = results.slice(0, criteria.maxReturned);
                break;
            }
        }
    }
}
