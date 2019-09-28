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

import { isScoredAspectFingerprint } from "../../aspect/score/ScoredAspect";
import { RepositoryScorer } from "../../aspect/AspectRegistry";

/**
 * Use as an inMemory scorer. Exposes persisted scores.
 * Useful during development.
 * @param {string} name
 * @return {RepositoryScorer}
 */
export function exposeFingerprintScore(name: string): RepositoryScorer {
    return {
        name,
        scoreFingerprints: async repo => {
            const found = repo.analysis.fingerprints
                .filter(isScoredAspectFingerprint)
                .find(fp => fp.type === name);
            return !!found ?
                {
                    score: found.data.weightedScore,
                    reason: JSON.stringify(found.data.weightedScores),
                } as any :
                undefined;
        },
    };
}
