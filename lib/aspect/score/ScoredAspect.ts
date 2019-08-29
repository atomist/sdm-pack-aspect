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

import { PushImpactListenerInvocation } from "@atomist/sdm";

import { Project } from "@atomist/automation-client";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import {
    Score,
    Scored,
    Scores,
    scoresFor,
    ScoreWeightings,
    weightedCompositeScore,
    WeightedScore,
} from "../../scorer/Score";
import { starBand } from "../../util/commonBands";
import { RepositoryScorer, RepoToScore } from "../AspectRegistry";
import { AspectMetadata } from "../compose/commonTypes";

/**
 * Aspect that scores pushes or projects
 */
export type ScoredAspect = Aspect<WeightedScore>;

/**
 * Score the project and the push
 */
export type PushScorer = (pili: PushImpactListenerInvocation) => Promise<Score>;

const ScoredAspectDefaults: Pick<ScoredAspect, "stats" | "toDisplayableFingerprint"> = {
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
        basicStatsPath: "score",
    },
    toDisplayableFingerprint: fp => starBand(fp.data.weightedScore),
};

export type ProjectScorer = (p: Project) => Promise<Score | undefined>;

/**
 * Score this aspect based on projects, from low to high.
 * Requires no other fingerprints
 */
export function projectScoringAspect(
    opts: {
        scorers: ProjectScorer[],
        scoreWeightings?: ScoreWeightings,
    } & AspectMetadata): ScoredAspect {
    return {
        extract: async p => {
            const scores: Scores = await scoresFor(opts.scorers, p, {});
            const scored: Scored = { scores };
            const weightedScore = weightedCompositeScore(scored, opts.scoreWeightings);
            return toFingerprint(opts.name, weightedScore);
        },
        ...ScoredAspectDefaults,
        ...opts,
    };
}

/**
 * Score this aspect based on fingerprints, from low to high
 */
export function fingerprintScoringAspect(opts: {
    scorers: RepositoryScorer[],
    scoreWeightings?: ScoreWeightings,
} & AspectMetadata): ScoredAspect {
    return {
        extract: async () => [],
        consolidate: async (fingerprints, p) => {
            const repoToScore: RepoToScore = { analysis: { id: p.id, fingerprints } };
            const scores: Scores = await scoresFor(opts.scorers, repoToScore, {});
            const scored: Scored = { scores };
            const weightedScore = weightedCompositeScore(scored, opts.scoreWeightings);
            return toFingerprint(opts.name, weightedScore);
        },
        ...ScoredAspectDefaults,
        ...opts,
    };
}

/**
 * Calculate the risk of this compute with the given scorers, which should return a
 * score from 1 (low) to 5 (high).
 */
export function pushScoringAspect(
    opts: {
        scorers: PushScorer[],
        scoreWeightings?: ScoreWeightings,
    } & AspectMetadata): ScoredAspect {
    return {
        extract: async (p, pili) => {
            const scores: Scores = await scoresFor(opts.scorers, pili, p);
            const scored: Scored = { scores };
            const weightedScore = weightedCompositeScore(scored, opts.scoreWeightings);
            return toFingerprint(opts.name, weightedScore);
        },
        ...ScoredAspectDefaults,
        ...opts,
    };
}

function toFingerprint(type: string, data: WeightedScore): FP<WeightedScore> {
    return {
        type,
        name: type,
        data,
        sha: sha256(JSON.stringify(data.weightedScore)),
    };
}
