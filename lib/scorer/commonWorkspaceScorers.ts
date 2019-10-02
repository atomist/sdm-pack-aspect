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

import { WorkspaceScorer } from "../aspect/AspectRegistry";
import { FiveStar } from "./Score";

import * as _ from "lodash";

export const average = (array: number[]) => array.reduce((a, b) => a + b, 0) / array.length;

/**
 * Use the average repo score as the score
 */
export const AverageRepoScore: WorkspaceScorer = {
    name: "average",
    description: "Average score for repositories",
    score: async od => {
        const scores: number[] = od.repos.map(r => r.score);
        const score: FiveStar = average(scores) as any as FiveStar;
        return {
            reason: "mean of all scores",
            score,
        };
    },
};

/**
 * Use the score of the lowest scoring repo as a score
 */
export const WorstRepoScore: WorkspaceScorer = {
    name: "worst",
    description: "Worst repository",
    score: async od => {
        const scores: number[] = od.repos.map(r => r.score);
        const score = _.min(scores) as FiveStar;
        return {
            reason: "score of lowest scored repository",
            score,
        };
    },
};

/**
 * Score based on entropy across the organization
 */
export const EntropyScore: WorkspaceScorer = {
    name: "entropy",
    description: "Entropy across workspace",
    score: async od => {
        const scores: number[] = od.fingerprintUsage.map(f => {
            if (f.entropy > 3) {
                return 1;
            }
            if (f.entropy > 2) {
                return 2;
            }
            if (f.entropy > 1) {
                return 3;
            }
            if (f.entropy > .5) {
                return 4;
            }
            return 5;
        });
        const score: FiveStar = average(scores) as any as FiveStar;
        return {
            reason: "variance among aspects identified in this workspace",
            score,
        };
    },
};
