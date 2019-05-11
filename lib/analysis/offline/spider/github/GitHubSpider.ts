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
    GitCommandGitProject,
    logger,
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/lib/operations/common/GitHubRepoRef";
import {
    Interpretation,
    ProjectAnalysis,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import * as Octokit from "@octokit/rest";
import { SpideredRepo } from "../../SpideredRepo";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Spider,
    SpiderOptions,
} from "../Spider";
import { SubprojectStatus } from "../../../subprojectFinder";

/**
 * Spider GitHub. Ensure that GITHUB_TOKEN environment variable is set.
 */
export class GitHubSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: ProjectAnalyzer,
                        opts: SpiderOptions): Promise<number> {
        const it = queryByCriteria(process.env.GITHUB_TOKEN, criteria);

        let bucket: Array<Promise<any>> = [];
        let count = 0;

        for await (const sourceData of it) {
            ++count;
            const repo = {
                owner: sourceData.owner.login,
                repo: sourceData.name,
                url: sourceData.url,
            };
            const found = await opts.persister.load(repo);
            if (found && await opts.keepExistingPersisted(found)) {
                logger.info("Found valid record for " + JSON.stringify(repo));
            } else {
                logger.info("Performing fresh analysis of " + JSON.stringify(repo));
                try {
                    bucket.push(analyzeAndPersist(sourceData, criteria, analyzer, opts));
                    if (bucket.length === opts.poolSize) {
                        // Run all promises together. Effectively promise pooling
                        await Promise.all(bucket);
                        bucket = [];
                    }
                } catch (err) {
                    logger.error("Failure analyzing repo at %s: %s", sourceData.url, err.message);
                }
            }
        }
        return count;
    }

}

/**
 * Future for doing the work
 * @return {Promise<void>}
 */
async function analyzeAndPersist(sourceData: GitHubSearchResult,
                                 criteria: ScmSearchCriteria,
                                 analyzer: ProjectAnalyzer,
                                 opts: SpiderOptions): Promise<void> {
    const repoInfos = await cloneAndAnalyze(sourceData, analyzer, criteria);
    for (const repoInfo of repoInfos) {
        if (!criteria.interpretationTest || criteria.interpretationTest(repoInfo.interpretation)) {
            const toPersist: SpideredRepo = {
                analysis: {
                    // Use a spread as url has a getter and otherwise disappears
                    ...repoInfo.analysis,
                    id: {
                        ...repoInfo.analysis.id,
                        url: sourceData.html_url,
                    },
                },
                topics: [], // enriched.interpretation.keywords,
                sourceData,
                timestamp: sourceData.timestamp,
                query: sourceData.query,
                readme: repoInfo.readme,
                parentId: repoInfo.parentId,
            };
            await opts.persister.persist(toPersist);
            if (opts.onPersisted) {
                try {
                    await opts.onPersisted(toPersist);
                } catch (err) {
                    logger.warn("Failed to action after persist repo %j: %s",
                        toPersist.analysis.id, err.message);
                }
            }
        }
    }
}

/**
 * Result row in a GitHub search
 */
interface GitHubSearchResult {
    owner: { login: string };
    name: string;
    url: string;
    html_url: string;
    timestamp: Date;
    query: string;
}

interface RepoInfo {
    readme: string;
    totalFileCount: number;
    interpretation: Interpretation;
    analysis: ProjectAnalysis;
    parentId: RemoteRepoRef;
}

/**
 * Find project or subprojects
 */
async function cloneAndAnalyze(gitHubRecord: GitHubSearchResult,
                               analyzer: ProjectAnalyzer,
                               criteria: ScmSearchCriteria): Promise<RepoInfo[]> {
    const project = await GitCommandGitProject.cloned(
        process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : undefined,
        GitHubRepoRef.from({ owner: gitHubRecord.owner.login, repo: gitHubRecord.name }), {
            alwaysDeep: false,
            depth: 1,
        });
    if (criteria.projectTest && !await criteria.projectTest(project)) {
        logger.info("Skipping analysis of %s as it doesn't pass projectTest", project.id.url);
        return [];
    }
    const subprojects = criteria.subprojectFinder ?
        await criteria.subprojectFinder(project) :
        { status: SubprojectStatus.Unknown };
    if (!!subprojects.paths) {
        throw new Error("Not yet handling subprojects");
    }
    return [await analyzeProject(project, analyzer, undefined)];
}

/**
 * Analyze a project. May be a virtual project, within a bigger project.
 */
async function analyzeProject(project: Project,
                              analyzer: ProjectAnalyzer,
                              parentId: RemoteRepoRef): Promise<RepoInfo> {
    const readmeFile = await project.getFile("README.md");
    const readme = !!readmeFile ? await readmeFile.getContent() : undefined;
    const totalFileCount = await project.totalFileCount();

    const analysis = await analyzer.analyze(project, undefined, { full: true });
    const interpretation = await analyzer.interpret(analysis, undefined);

    return {
        readme,
        totalFileCount,
        interpretation,
        analysis,
        parentId,
    };
}

async function* queryByCriteria(token: string, criteria: ScmSearchCriteria): AsyncIterable<GitHubSearchResult> {
    const octokit = new Octokit();
    if (!!token) {
        octokit.authenticate({
            type: "token",
            token,
        });
    }
    let results: any[] = [];
    let retrieved = 0;
    for (const q of criteria.githubQueries) {
        logger.info("Running query " + q + "...");
        const options = octokit.search.repos.endpoint.merge({ q });
        for await (const response of octokit.paginate.iterator(options)) {
            retrieved += response.data.items.length;
            const newResults = response.data.items
                .filter((r: any) => !results.some(existing => existing.full_name === r.full_name));
            newResults.forEach((r: any) => {
                r.query = q;
                r.timestamp = new Date();
            });
            for (const newResult of newResults) {
                yield newResult;
            }
            logger.info(`Looked at ${retrieved} repos of max ${criteria.maxRetrieved}...`);
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
