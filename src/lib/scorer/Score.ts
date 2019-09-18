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

import { logger } from "@atomist/automation-client";
import { Omit } from "../util/omit";

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

/**
 * Score value
 */
export type FiveStar = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Scores with this category are always included in any score computation
 */
export const AlwaysIncludeCategory: "*" = "*";

/**
 * Represents a quality ranking of a particular element of a project.
 * The numeric score will be from from 1-5, where 1 is very bad and 5 is very good.
 */
export interface Score {

    readonly name: string;

    /**
     * Category this score belongs to, if any
     */
    readonly category?: string;

    /**
     * Explanation for this score, if available
     */
    readonly reason?: string;

    /**
     * Score for this project
     */
    readonly score: FiveStar;

}

/**
 * Structure representing a score on a particular aspect of a project.
 * The key is the scorer name
 */
export type Scores = Record<string, Score>;

/**
 * Weighting of a particular scorer
 */
export type Weighting = 1 | 2 | 3;

export interface Scored {
    readonly scores: Scores;
}

/**
 * Weighting to apply to this name score. Default is 1.
 * Other values can be used to increase the weighting.
 */
export type ScoreWeightings = Record<string, Weighting>;

export type WeightedScores = Record<string, Score & { weighting: Weighting }>;

export interface WeightedScore {

    /**
     * Weighted score
     */
    weightedScore: number;

    /**
     * Individual component scores
     */
    weightedScores: WeightedScores;
}

/**
 * Perform a weighted composite score for the given scores.
 * Returns a real number from 0 to 5
 */
export function weightedCompositeScore(scored: Scored,
                                       weightings: ScoreWeightings = {}): WeightedScore | undefined {
    const keys = Object.getOwnPropertyNames(scored.scores);
    if (keys.length === 0) {
        return {
            weightedScore: 3,
            weightedScores: {},
        };
    }

    const weightedScores: WeightedScores = {};
    let compositeScore: number = 0.0;
    let divideBy = 0;
    const scores = keys.map(k => scored.scores[k]);
    for (const score of scores) {
        if (Number.isNaN(score.score)) {
            logger.error("Invalid score: %j", score);
            continue;
        }
        const weighting = weightings[score.name] || 1;
        weightedScores[score.name] = {
            ...score,
            weighting,
        };
        compositeScore += score.score * weighting;
        divideBy += weighting;
    }
    const weightedScore = compositeScore / (divideBy || 1);
    return {
        weightedScore,
        weightedScores,
    };
}

/**
 * Extended by types that can perform scoring
 */
export interface Scorer {

    /**
     * Name of the scorer. Will be included in all scores.
     */
    readonly name: string;

    /**
     * Category to include in scores, if any
     */
    readonly category?: string;
}

/**
 * Type returned by any scorer
 */
export type ScorerReturn = Omit<Score, "name" | "category"> | undefined;
