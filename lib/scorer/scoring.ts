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
    OrgData,
    OrgScorer,
    RepositoryScorer,
    RepoToScore,
    ScoredRepo,
    TagAndScoreOptions,
} from "../aspect/AspectRegistry";
import { fingerprintScoresFor } from "../aspect/score/ScoredAspect";
import {
    AlwaysIncludeCategory,
    FiveStar,
    Score,
    Scores,
    ScoreWeightings,
    weightedCompositeScore,
    WeightedScore,
} from "./Score";

export async function scoreRepos(scorers: RepositoryScorer[],
                                 repos: RepoToScore[],
                                 weightings: ScoreWeightings,
                                 opts: TagAndScoreOptions): Promise<ScoredRepo[]> {
    return Promise.all(repos.map(repo => scoreRepo(scorers, repo, weightings, opts)));
}

/**
 * Score the repo
 */
export async function scoreOrg(scorers: OrgScorer[],
                               od: OrgData,
                               weightings: ScoreWeightings): Promise<WeightedScore> {
    const scores: Scores = {};
    for (const scorer of scorers) {
        scores[scorer.name] = { ...scorer, ...await scorer.score(od) };
    }
    // Remove scores that don't match our desired category
    // for (const key of Object.keys(scores)) {
    //     const score = scores[key];
    //     if (opts.category && score.category !== opts.category && opts.category !== AlwaysIncludeCategory) {
    //         delete scores[key];
    //     }
    // }
    return weightedCompositeScore({ scores }, weightings);
}

export async function scoreRepo(scorers: RepositoryScorer[],
                                repo: RepoToScore,
                                weightings: ScoreWeightings,
                                opts: TagAndScoreOptions): Promise<ScoredRepo> {
    const scores = await fingerprintScoresFor(scorers, repo);
    // Remove scores that don't match our desired category
    for (const key of Object.keys(scores)) {
        const score = scores[key];
        if (opts.category && score.category !== opts.category && opts.category !== AlwaysIncludeCategory) {
            delete scores[key];
        }
    }
    return {
        ...repo,
        weightedScore: weightedCompositeScore({ scores }, weightings),
    };
}

/**
 * Score the given object in the given context
 * @param scoreFunctions scoring functions. Undefined returns will be ignored
 * @param {T} toScore what to score
 * @param {CONTEXT} context
 * @return {Promise<Scores>}
 */
async function scoresFor<T, CONTEXT>(scoreFunctions: Array<(t: T, c: CONTEXT) => Promise<Score | undefined>>,
                                     toScore: T,
                                     context: CONTEXT): Promise<Scores> {
    const scores: Scores = {};
    const runFunctions = scoreFunctions.map(scorer => scorer(toScore, context).then(score => {
        if (score) {
            scores[score.name] = score;
        }
    }));
    await Promise.all(runFunctions);
    return scores;
}

/**
 * Adjust a score within FiveStar range.
 * If merits is negative, reduce
 * @param {number} merits
 * @param {FiveStar} startAt
 * @return {FiveStar}
 */
export function adjustBy(merits: number, startAt: FiveStar = 5): FiveStar {
    const score = startAt + merits;
    return Math.min(Math.max(score, 1), 5) as FiveStar;
}
