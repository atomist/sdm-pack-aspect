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
    Project,
    RepoId,
    RepoRef,
} from "@atomist/automation-client";
import { Aspect } from "@atomist/sdm-pack-fingerprint";
import { Analyzed } from "../../../aspect/AspectRegistry";
import {
    AnalysisTracker,
    RepoBeingTracked,
} from "../../tracking/analysisTracker";
import {
    ProjectAnalysisResultStore,
} from "../persist/ProjectAnalysisResultStore";
import { computeAnalytics } from "./analytics";
import {
    Analyzer,
    ProjectAnalysisResultFilter,
    SpiderResult,
} from "./Spider";

/**
 * A reasonable number of repositories to analyze at a time.
 * The bucketing mechanism will wait for this many to complete, then
 * start another batch. If this is too big, the web interface can't respond.
 */
export const DefaultPoolSize = 6;

interface TrackedRepo<FoundRepo> {
    foundRepo: FoundRepo;
    tracking: RepoBeingTracked;
    repoRef?: RepoRef;
}

/**
 * This class knows how to execute an analysis run,
 * given some functions that are specific to the source
 * of the repositories.
 */
export class AnalysisRun<FoundRepo> {

    constructor(
        private readonly world: {
            howToFindRepos: () => AsyncIterable<FoundRepo>,
            determineRepoRef: (f: FoundRepo) => Promise<RepoRef>,
            describeFoundRepo: (f: FoundRepo) => RepoDescription,
            howToClone: (rr: RepoRef, fr: FoundRepo) => Promise<GitProject>,
            analyzer: Analyzer;
            persister: ProjectAnalysisResultStore,
            analysisTracking: AnalysisTracker,

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
            this.params.poolSize = DefaultPoolSize;
        }
    }

    public async run(): Promise<SpiderResult> {

        const analysisBeingTracked = this.world.analysisTracking.startAnalysis({
            workspaceId: this.params.workspaceId,
            description: this.params.description,
        });

        let trackedRepos: Array<TrackedRepo<FoundRepo>>;
        try {

            const plannedRepos = await takeFromIterator(this.params.maxRepos, this.world.howToFindRepos());
            trackedRepos =
                plannedRepos.map(pr => ({
                    tracking: analysisBeingTracked.plan(this.world.describeFoundRepo(pr)),
                    foundRepo: pr,
                }));
        } catch (error) {
            analysisBeingTracked.failed(error);
            return emptySpiderResult;
        }

        try {

            // run poolSize at the same time
            const chewThroughThese = trackedRepos.slice();
            while (chewThroughThese.length > 0) {
                const promises = chewThroughThese.splice(0, this.params.poolSize)
                    .map(trackedRepo => analyzeOneRepo(this.world, { ...trackedRepo, workspaceId: this.params.workspaceId }));
                await Promise.all(promises);
            }

            logger.debug("Computing analytics over all fingerprints...");
            // Question for Rod: should this run intermittently or only at the end?
            // Answer from Rod: intermittently.
            // but any failure in the middle of analysis can cause the analytics to be incomplete/missing.
            await computeAnalytics(this.world, this.params.workspaceId);
            const finalResult = trackedRepos.map(tr => tr.tracking.spiderResult()).reduce(combineSpiderResults, emptySpiderResult);
            analysisBeingTracked.stop();
            return finalResult;
        } catch (error) {
            const finalResult = trackedRepos.map(tr => tr.tracking.spiderResult()).reduce(combineSpiderResults, emptySpiderResult);
            analysisBeingTracked.failed(error);
            return finalResult;
        }
    }
}

interface RepoDescription {
    description: string;
    url?: string;
}

async function analyzeOneRepo<FoundRepo>(
    world: {
        howToFindRepos: () => AsyncIterable<FoundRepo>,
        determineRepoRef: (f: FoundRepo) => Promise<RepoRef>,
        describeFoundRepo: (f: FoundRepo) => RepoDescription,
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
    logger.info("Now analyzing: " + JSON.stringify(params.foundRepo));
    const { tracking, workspaceId, foundRepo } = params;
    tracking.beganAnalysis();

    const repoRef = await world.determineRepoRef(foundRepo);
    tracking.setRepoRef(repoRef);

    // we might choose to skip this one
    try {
        if (await existingRecordShouldBeKept(world, workspaceId, repoRef)) {
            // enhancement: record timestamp of kept record
            tracking.keptExisting();
            return;
        }
    } catch (error) {
        tracking.failed({ whileTryingTo: "check whether to keep existing", error });
        return;
    }

    // clone
    let project: GitProject;
    try {
        project = await world.howToClone(repoRef, foundRepo);
    } catch (error) {
        tracking.failed({ whileTryingTo: "clone", error });
        return;
    }

    // we might choose to skip this one (is this used anywhere?)
    if (world.projectFilter && !await world.projectFilter(project)) {
        tracking.skipped("projectFilter returned false");
        return;
    }

    // analyze !
    let analysis: Analyzed;
    try {
        analysis = await world.analyzer.analyze(project, tracking);
    } catch (error) {
        tracking.failed({ whileTryingTo: "analyze", error });
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

    persistResult.failedFingerprints.forEach(f => {
        tracking.failFingerprint(f.failedFingerprint, f.error);
    });

    if (persistResult.failed.length === 1) {
        tracking.failed(persistResult.failed[0]);
    } else if (persistResult.succeeded.length === 1) {
        tracking.persisted(persistResult.succeeded[0]);
    } else {
        throw new Error("Unexpected condition in persistResult: " + JSON.stringify(persistResult));
    }
}

async function existingRecordShouldBeKept(
    opts: {
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
    },
    workspaceId: string,
    repoId: RepoId): Promise<boolean> {
    const found = await opts.persister.loadByRepoRef(workspaceId, repoId, true);
    if (!found || !found.analysis) {
        return false;
    }
    return opts.keepExistingPersisted(found);
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
        failed:
            [...r1.failed, ...r2.failed],
        keptExisting: [...r1.keptExisting, ...r2.keptExisting],
        persistedAnalyses: [...r1.persistedAnalyses, ...r2.persistedAnalyses],
    };
}

const emptySpiderResult = {
    repositoriesDetected: 0,
    failed:
        [],
    keptExisting: [],
    persistedAnalyses: [],
};
