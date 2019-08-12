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
    RemoteRepoRef,
    Severity,
} from "@atomist/automation-client";
import {
    Score,
    WeightedScore,
} from "@atomist/sdm-pack-analysis";
import {
    Aspect,
    AtomicAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { IdealStore } from "./IdealStore";
import {
    ProblemStore,
    UndesirableUsageChecker,
} from "./ProblemStore";

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: FP[];
}

/**
 * Result of an analysis. We must always have at least fingerprints and repo identification
 */
export type Analyzed = HasFingerprints & { id: RemoteRepoRef };

/**
 * Type of Aspect we can manage
 */
export type ManagedAspect<FPI extends FP = FP> = Aspect<FPI> | AtomicAspect<FPI>;

/**
 * Tag based on fingerprint data.
 */
export interface Tag {

    name: string;

    description?: string;

    /**
     * Severity if this tag is associated with an action
     */
    severity?: Severity;
}

export type TaggedRepo = ProjectAnalysisResult & { tags: Tag[] };

export type ScoredRepo = TaggedRepo & { weightedScore: WeightedScore };

export type RepositoryScorer = (r: TaggedRepo, ctx: any) => Promise<Score | undefined>;

/**
 * Manage a number of aspects.
 */
export interface AspectRegistry {

    tagAndScoreRepos(repos: ProjectAnalysisResult[]): Promise<ScoredRepo[]>;

    availableTags: Tag[];

    /**
     * All the aspects we are managing
     */
    readonly aspects: ManagedAspect[];

    /**
     * Find the aspect that manages fingerprints of this type
     */
    aspectOf(type: string): ManagedAspect | undefined;

    /**
     * Function that can resolve ideal status for this aspect
     */
    readonly idealStore: IdealStore;

    readonly problemStore: ProblemStore;

    /**
     * Return an UndesirableUsageChecker for this workspace
     */
    undesirableUsageCheckerFor(workspaceId: string): Promise<UndesirableUsageChecker>;

}
