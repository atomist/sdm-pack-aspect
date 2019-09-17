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

import { OrgScorer } from "../aspect/AspectRegistry";
import { FiveStar } from "./Score";

import * as _ from "lodash";

const average = array => array.reduce((a, b) => a + b) / array.length;

export const AverageRepoScore: OrgScorer = {
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

export const WorstRepoScore: OrgScorer = {
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

export const EntropyScore: OrgScorer = {
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
