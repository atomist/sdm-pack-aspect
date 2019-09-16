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

import { RepoRef } from "@atomist/automation-client";
import { FP } from "@atomist/sdm-pack-fingerprint";
import { Analyzed } from "../../../aspect/AspectRegistry";
import { PlantedTree } from "../../../tree/sunburst";
import { ProjectAnalysisResult } from "../../ProjectAnalysisResult";
import { CohortAnalysis } from "../spider/analytics";
import {
    PersistenceResult,
    SpiderFailure,
} from "../spider/Spider";

export interface PersistResult {
    attemptedCount: number;
    failed: SpiderFailure[];
    succeeded: PersistenceResult[];
    failedFingerprints: Array<{ failedFingerprint: FP; error: Error }>;
}

export function combinePersistResults(r1: PersistResult, r2: PersistResult): PersistResult {
    return {
        attemptedCount: r1.attemptedCount + r2.attemptedCount,
        failed: [...r1.failed, ...r2.failed],
        succeeded: [...r1.succeeded, ...r2.succeeded],
        failedFingerprints: [...r1.failedFingerprints, ...r2.failedFingerprints],
    };
}

export const emptyPersistResult: PersistResult = {
    attemptedCount: 0,
    failed: [],
    succeeded: [],
    failedFingerprints: [],
};

export type FingerprintKind = Pick<FP, "type" | "name">;

/**
 * Data about the use of a fingerprint in a workspace
 */
export interface FingerprintUsage extends CohortAnalysis {
    name: string;
    type: string;
}

export interface TreeQuery {

    workspaceId: string;

    aspectName: string;

    rootName: string;

    /**
     * Look for one particular fingerprint?
     */
    byName: boolean;

    /**
     * If this is supplied, query for results even without fingerprints from this aspect
     * and use this as the name
     */
    otherLabel?: string;
}

export interface FingerprintInsertionResult {
    insertedCount: number;
    failures: Array<{ failedFingerprint: FP; error: Error }>;
}

/**
 * Interface for basic persistence operations.
 * Implementations can provide additional querying options,
 * e.g. through SQL.
 * '*' is consistently used in place for workspaceId to return
 * data for all workspaces.
 */
export interface ProjectAnalysisResultStore {

    fingerprintsToReposTree(tq: TreeQuery): Promise<PlantedTree>;

    /**
     * Drift tree
     * @param {string} workspaceId
     * @param {number} percentile (0-100). Show fingerprints only with entropy above this
     * @param {string} type if provided, show drift only for the particular aspect. Otherwise
     * show drift for all aspects.
     * @return {Promise<PlantedTree>}
     */
    aspectDriftTree(workspaceId: string,
        percentile: number,
        type?: string): Promise<PlantedTree>;

    /**
     * How many repos we've analyzed
     */
    distinctRepoCount(workspaceId: string): Promise<number>;

    /**
     * Virtual project count. One repository may contain multiple virtual projects
     */
    virtualProjectCount(workspaceId: string): Promise<number>;

    /**
     * What's the most recent snapshot timestamp we've seen in this workspace?
     * @param {string} workspaceId
     * @return {Promise<Date>}
     */
    latestTimestamp(workspaceId: string): Promise<Date>;

    /**
     * Load in the given workspace
     * @param workspaceId  '*' for all workspaces
     * @param deep whether to load deep
     */
    loadInWorkspace(workspaceId: string, deep: boolean): Promise<ProjectAnalysisResult[]>;

    loadByRepoRef(repo: RepoRef, deep: boolean): Promise<ProjectAnalysisResult | undefined>;

    /**
     * Load by our database id
     * @param {string} id
     * @return {Promise<ProjectAnalysisResult | undefined>}
     */
    loadById(id: string): Promise<ProjectAnalysisResult | undefined>;

    persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult>;

    /**
     * Persist fingerprints for this snapshot id, which must already exist.
     */
    persistAdditionalFingerprints(analyzed: Analyzed): Promise<FingerprintInsertionResult>;

    /**
     * Return distinct fingerprint type/name combinations in this workspace
     */
    distinctFingerprintKinds(workspaceId: string): Promise<FingerprintKind[]>;

    /**
     * Return distinct fingerprint type/name combinations in this workspace by repo
     */
    distinctRepoFingerprintKinds(workspaceId: string): Promise<Array<{ owner: string, repo: string, fingerprints: FingerprintKind[] }>>;

    fingerprintUsageForType(workspaceId: string, type?: string): Promise<FingerprintUsage[]>;

    /**
     * Persist a record of analytics. Can be invoked repeatedly on the same data without error.
     */
    persistAnalytics(params: Array<{ workspaceId: string, kind: FingerprintKind, cohortAnalysis: CohortAnalysis }>): Promise<boolean>;

    /**
     * Return all the fingerprints in this workspace, optionally narrowed by type and name
     * @param workspaceId workspaceId. Use * for all workspaces
     * @param distinct whether to remove duplicates
     * @param type fingerprint type (optional)
     * @param name fingerprint name (optional)
     */
    fingerprintsInWorkspace(workspaceId: string,
        distinct: boolean,
        type?: string,
        name?: string): Promise<Array<FP & { id: string }>>;

    fingerprintsForProject(id: string): Promise<Array<FP & { timestamp: Date, commitSha: string }>>;

    /**
     * Return the average number of fingerprints in the workspace
     * @param {string} workspaceId
     * @return {Promise<number>}
     */
    averageFingerprintCount(workspaceId?: string): Promise<number>;

}
