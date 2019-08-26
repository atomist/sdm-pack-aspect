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
    GitProject,
    logger,
    Project,
    RepoId,
    RepoRef,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as path from "path";
import { Analyzed } from "../../../../aspect/AspectRegistry";
import { globalAnalysisTracking, RepoBeingTracked } from "../../../tracking/analysisTracker";
import {
    ProjectAnalysisResultStore,
} from "../../persist/ProjectAnalysisResultStore";
import { computeAnalytics } from "../analytics";
import {
    existingRecordShouldBeKept,
} from "../common";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Analyzer,
    ProjectAnalysisResultFilter,
    Spider,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

interface TrackedRepo<FoundRepo> {
    foundRepo: FoundRepo;
    tracking: RepoBeingTracked;
    repoRef?: RepoRef;
}

export class AnalysisRun<FoundRepo> {
    public opts: any;

    constructor(
        private readonly world: {
            howToFindRepos: () => AsyncIterable<FoundRepo>,
            determineRepoRef: (f: FoundRepo) => Promise<RepoRef>,
            describeFoundRepo: (f: FoundRepo) => string,
            howToClone: (rr: RepoRef, fr: FoundRepo) => Promise<GitProject>,
            analyzer: Analyzer;
            persister: ProjectAnalysisResultStore,

            keepExistingPersisted: ProjectAnalysisResultFilter,
            projectFilter?: (p: Project) => Promise<boolean>;
        },
        private readonly params: {
            workspaceId: string;
            description: string;
            maxRepos?: number;
            poolSize?: number;
        }) {
        if (!this.params.maxRepos) {
            this.params.maxRepos = 1000;
        }
        if (!this.params.poolSize) {
            this.params.poolSize = 40;
        }
    }

    public async run(): Promise<SpiderResult> {

        const analysisBeingTracked = globalAnalysisTracking.startAnalysis({
            description: this.params.description,
        });

        const plannedRepos = await takeFromIterator(this.params.maxRepos, this.world.howToFindRepos());
        const trackedRepos: Array<TrackedRepo<FoundRepo>> =
            plannedRepos.map(pr => ({
                tracking: analysisBeingTracked.plan(({ description: this.world.describeFoundRepo(pr) })),
                foundRepo: pr,
            }));

        // run poolSize at the same time
        const chewThroughThese = trackedRepos.slice();
        while (chewThroughThese.length > 0) {
            const promises = chewThroughThese.splice(0, this.params.poolSize)
                .map(trackedRepo => analyzeOneRepo(this.world, { ...trackedRepo, workspaceId: this.params.workspaceId }));
            await Promise.all(promises);
        }

        logger.debug("Computing analytics over all fingerprints...");
        // Question for Rod: should this run intermittently or only at the end?
        // Answer from Rod: intermitently.

        await computeAnalytics(this.world.persister, this.params.workspaceId);
        const finalResult = trackedRepos.map(tr => tr.tracking.spiderResult()).reduce(combineSpiderResults, emptySpiderResult);
        analysisBeingTracked.stop(finalResult);
        return finalResult;
    }
}

async function analyzeOneRepo<FoundRepo>(
    world: {
        howToFindRepos: () => AsyncIterable<FoundRepo>,
        determineRepoRef: (f: FoundRepo) => Promise<RepoRef>,
        describeFoundRepo: (f: FoundRepo) => string,
        howToClone: (rr: RepoRef, fr: FoundRepo) => Promise<GitProject>,
        analyzer: Analyzer;
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
        projectFilter?: (p: Project) => Promise<boolean>;
    },
    params: {
        workspaceId: string,
        foundRepo: FoundRepo,
        tracking: RepoBeingTracked,
    }): Promise<void> {
    logger.warn("Now analyzing: " + params.foundRepo);
    const startTime = new Date().getTime(); // jess: move this into the tracking
    const { tracking, workspaceId, foundRepo } = params;

    const repoRef = await world.determineRepoRef(foundRepo);
    tracking.setRepoRef(repoRef);

    // we might choose to skip this one
    if (await existingRecordShouldBeKept(world, repoRef)) {
        // enhancement: record timestamp of kept record
        tracking.keptExisting(new Date().getTime() - startTime);
        return;
    }

    // clone
    let project: GitProject;
    try {
        project = await world.howToClone(repoRef, foundRepo);
    } catch (error) {
        tracking.failed({ whileTryingTo: "clone", error }, new Date().getTime() - startTime);
        return;
    }

    // we might choose to skip this one (is this used anywhere?)
    if (world.projectFilter && !await world.projectFilter(project)) {
        tracking.skipped("projectFilter returned false", new Date().getTime() - startTime);
        return;
    }

    // analyze !
    let analysis: Analyzed;
    try {
        analysis = await world.analyzer.analyze(project);
    } catch (error) {
        tracking.failed({ whileTryingTo: "analyze", error }, new Date().getTime() - startTime);
        return;
    }

    // save :-)
    const persistResult = await world.persister.persist({
        workspaceId,
        repoRef,
        analysis: {
            ...analysis,
            id: repoRef, // necessary?
        },
        timestamp: new Date(),
    });

    if (persistResult.failed.length === 1) {
        tracking.failed(persistResult.failed[0], new Date().getTime() - startTime);
    } else if (persistResult.succeeded.length === 1) {
        tracking.persisted(new Date().getTime() - startTime);
    } else {
        throw new Error("Unexpected condition in persistResult: " + JSON.stringify(persistResult));
    }
}
export class LocalSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: Analyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {

        const go = new AnalysisRun<string>({
            howToFindRepos: () => findRepositoriesUnder(this.localDirectory),
            determineRepoRef: repoRefFromLocalRepo,
            describeFoundRepo: f => f,
            howToClone: (rr, fr) => GitCommandGitProject.fromExistingDirectory(rr, fr) as Promise<GitProject>,
            analyzer,
            persister: opts.persister,

            keepExistingPersisted: opts.keepExistingPersisted,
            projectFilter: criteria.projectTest,
        }, {
                workspaceId: opts.workspaceId,
                description: "local analysis under " + this.localDirectory,
                maxRepos: 1000,
                poolSize: opts.poolSize,
            });

        return go.run();
    }

    constructor(public readonly localDirectory: string) {
    }
}

async function takeFromIterator<T>(max: number, iter: AsyncIterable<T>): Promise<T[]> {
    let i = 0;
    const result: T[] = [];
    for await (const t of iter) {
        if (++i > max) {
            return result;
        }
        result.push(t);
    }
    return result;
}

function combineSpiderResults(r1: SpiderResult, r2: SpiderResult): SpiderResult {
    return {
        repositoriesDetected: r1.repositoriesDetected + r2.repositoriesDetected,
        projectsDetected: r1.projectsDetected + r2.projectsDetected,
        failed:
            [...r1.failed, ...r2.failed],
        keptExisting: [...r1.keptExisting, ...r2.keptExisting],
        persistedAnalyses: [...r1.persistedAnalyses, ...r2.persistedAnalyses],
    };
}

const emptySpiderResult = {
    repositoriesDetected: 0,
    projectsDetected: 0,
    failed:
        [],
    keptExisting: [],
    persistedAnalyses: [],
};

const oneSpiderResult = {
    ...emptySpiderResult,
    repositoriesDetected: 1,
    projectsDetected: 1,
};

async function* findRepositoriesUnder(dir: string): AsyncIterable<string> {
    try {
        const stat = await fs.stat(await fs.realpath(dir));
        if (!stat.isDirectory()) {
            // nothing interesting
            return;
        }
    } catch (err) {
        logger.error("Error opening " + dir + ": " + err.message);
        return;
    }

    const dirContents = await fs.readdir(dir);
    if (dirContents.includes(".git")) {
        // this is the repository you are looking for
        yield dir;
        return;
    }

    // recurse over everything inside
    for (const d of dirContents) {
        for await (const dd of findRepositoriesUnder(path.join(dir, d))) {
            yield dd;
        }
    }
}

/**
 * @param repoDir full path to repository
 */
async function repoRefFromLocalRepo(repoDir: string): Promise<RepoRef> {
    const repoId: RepoId = await execPromise("git", ["remote", "get-url", "origin"], { cwd: repoDir })
        .then(execHappened => repoIdFromOriginUrl(execHappened.stdout))
        .catch(() => inventRepoId(repoDir));

    const sha = await execPromise("git", ["rev-parse", "HEAD"], { cwd: repoDir })
        .then(execHappened => execHappened.stdout.trim())
        .catch(() => "unknown");

    return {
        ...repoId,
        sha,
    };
}

function repoIdFromOriginUrl(originUrl: string): RepoId {
    const parse = /\/(?<owner>.+)\/(?<repo>.+)(.git)?$/.exec(originUrl);

    if (!parse) {
        throw new Error("Can't identify owner and repo in url: " + originUrl);
    }

    return {
        repo: parse.groups.repo,
        owner: parse.groups.owner,
        url: originUrl,
    };
}

function inventRepoId(repoDir: string): RepoId {
    const { base, dir } = path.parse(repoDir);
    const repo = base;
    const owner = path.parse(dir).base || "pretendOwner";

    return {
        repo,
        owner,
        url: "file://" + repoDir,
    };
}
