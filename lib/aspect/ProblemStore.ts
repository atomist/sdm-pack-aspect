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

import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { FP } from "@atomist/sdm-pack-fingerprints";

/**
 * Flag for an undesirable usage
 */
export interface ProblemUsage {

    readonly severity: "info" | "warn" | "error";

    /**
     * Authority this comes from
     */
    readonly authority: string;

    /**
     * Message to the user
     */
    readonly description?: string;

    /**
     * URL associated with this if one is available.
     * For example, a security advisory.
     */
    readonly url?: string;

    /**
     * The fingerprint we object to
     */
    readonly fingerprint: FP;
}

/**
 * Persistent store of problem fingerprints
 */
export interface ProblemStore {

    noteProblem(workspaceId: string, fingerprintId: string): Promise<void>;

    storeProblemFingerprint(workspaceId: string, problem: ProblemUsage): Promise<void>;

    loadProblems(workspaceId: string): Promise<ProblemUsage[]>;

}

/**
 * Check to see if the given fingerprint is undesirable in the given workspace.
 * Enables code to be used along with fingerprints persisted in ProblemStore.
 */
export type UndesirableUsageCheck = (fp: FP, workspaceId: string) => ProblemUsage[];

/**
 * Type that can flag an issue with a fingerprint.
 * This is a programmatic complement to ProblemStore.
 */
export interface UndesirableUsageChecker {
    check: UndesirableUsageCheck;
}

/**
 * Don't report any problems
 */
export const AcceptEverythingUndesirableUsageChecker: UndesirableUsageChecker = {
    check: () => undefined,
};

/**
 * Create an UndesirableUsageChecker from a list of problem-finding functions
 */
export function chainUndesirableUsageCheckers(
    ...checkers: Array<(fp: FP, workspaceId: string) => ProblemUsage | ProblemUsage[] | undefined>): UndesirableUsageChecker {
    return {
        check: (fp, workspaceId) => {
            const problems: ProblemUsage[] = [];
            for (const f of checkers) {
                const flagged = f(fp, workspaceId);
                if (flagged) {
                    problems.push(...toArray(flagged));
                }
            }
            return problems;
        },
    };
}

/**
 * Undesirable usageChecker backed by a ProblemStore for the given workspace
 * @param {ProblemStore} problemStore
 * @param {string} workspaceId
 * @return {Promise<UndesirableUsageChecker>}
 */
export async function problemStoreBackedUndesirableUsageCheckerFor(problemStore: ProblemStore,
                                                                   workspaceId: string): Promise<UndesirableUsageChecker> {
    const problems: ProblemUsage[] = await problemStore.loadProblems(workspaceId);
    return {
        check: fp => {
            return problems.filter(p => p.fingerprint.sha === fp.sha);
        },
    };
}
