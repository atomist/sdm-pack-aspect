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

import { FP } from "@atomist/sdm-pack-fingerprint";
import { RepositoryScorer, RepoToScore } from "../aspect/AspectRegistry";
import { FiveStar } from "./Score";

/**
 * Emit the given score only when the condition is met.
 * Enables existing scorers to be reused in different context.
 */
export function makeConditional(scorer: RepositoryScorer,
                                test: (rts: RepoToScore) => boolean): RepositoryScorer {
    return {
        ...scorer,
        scoreFingerprints: async rts => {
            return test(rts) ?
                scorer.scoreFingerprints(rts) :
                undefined;
        },
    };
}

/**
 * Score with the given score when the fingerprint is present
 */
export function scoreOnFingerprintPresence(opts: {
    name: string,
    scoreWhenPresent?: FiveStar,
    scoreWhenAbsent?: FiveStar,
    reason: string,
    test: (fp: FP) => boolean,
}): RepositoryScorer {
    return {
        name: opts.name,
        scoreFingerprints: async rts => {
            const found = rts.analysis.fingerprints
                .find(opts.test);
            if (found && opts.scoreWhenPresent) {
                return {
                    reason: opts.reason + " - present",
                    score: opts.scoreWhenPresent,
                };
            } else if (opts.scoreWhenAbsent) {
                return {
                    reason: opts.reason + " - absent",
                    score: opts.scoreWhenAbsent,
                };
            }
            return undefined;
        },
    };
}
