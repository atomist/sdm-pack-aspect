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
    Scored,
    Scores,
    ScoreWeightings,
    weightedCompositeScore,
    WeightedScore,
} from "../../scorer/Score";
import { starBand } from "../../util/commonBands";
import {
    BaseScorer, BaseScorerReturn, isRepositoryScorer,
    RepositoryScorer,
    RepoToScore,
} from "../AspectRegistry";
import { AspectMetadata } from "../compose/commonTypes";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";

/**
 * Aspect that scores pushes or projects
 */
export type ScoredAspect = Aspect<WeightedScore>;

export function isScoredAspectFingerprint(fp: FP): fp is FP<WeightedScore> {
    const maybe = fp as FP<WeightedScore>;
    return !!maybe && !!maybe.data && !!maybe.data.weightedScore;
}

/**
 * Score the project and the push
 */
export interface PushScorer extends BaseScorer {
    scorePush: (pili: PushImpactListenerInvocation) => Promise<BaseScorerReturn>;
}

/**
 * Default properties to configure ScoredAspect
 */
const ScoredAspectDefaults: Pick<ScoredAspect, "stats" | "toDisplayableFingerprint"> = {
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
        basicStatsPath: "score",
    },
    toDisplayableFingerprint: fp => starBand(fp.data.weightedScore),
};

/**
 * Scorer that works with project content
 */
export interface ProjectScorer extends BaseScorer {

    scoreProject: (p: Project) => Promise<BaseScorerReturn>;
}

export function isPushScorer(scorer: BaseScorer): scorer is PushScorer {
    const maybe = scorer as PushScorer;
    return !!maybe.scorePush;
}

/**
 * Score this aspect based on projects, from low to high.
 * Requires no other fingerprints
 */
export function pushScoringAspect(
    opts: {
        scorers: Array<PushScorer | ProjectScorer>,
        scoreWeightings?: ScoreWeightings,
    } & AspectMetadata): ScoredAspect {
    return {
        extract: async (p, pili) => {
            const scores: Scores = await pushScoresFor(opts.scorers, pili);
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
            const scores: Scores = await fingerprintScoresFor(opts.scorers, repoToScore);
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

export async function fingerprintScoresFor(repositoryScorers: RepositoryScorer[],
                                           toScore: RepoToScore): Promise<Scores> {
    const scores: Scores = {};
    for (const scorer of repositoryScorers) {
        const sr = await scorer.scoreFingerprints(toScore);
        if (sr) {
            const score = {
                ...sr,
                name: scorer.name,
                category: scorer.category,
            };
            scores[score.name] = score;
        }
    }
    return scores;
}

export async function pushScoresFor(pushScorers: Array<PushScorer | ProjectScorer>,
                                    toScore: PushImpactListenerInvocation): Promise<Scores> {
    const scores: Scores = {};
    for (const scorer of pushScorers) {
        const sr = isPushScorer(scorer) ?
            await scorer.scorePush(toScore) :
            await scorer.scoreProject(toScore.project);
        if (sr) {
            const score = {
                ...sr,
                name: scorer.name,
                category: scorer.category,
            };
            scores[score.name] = score;
        }
    }
    return scores;
}

export function emitScoringAspects(name: string, scorers: BaseScorer[], scoreWeightings: ScoreWeightings): ScoredAspect[] {
    const fScorers = scorers.filter(isRepositoryScorer);
    const pScorers = scorers.filter(s => !isRepositoryScorer(s)) as any;
    const psa = pushScoringAspect(
        {
            name: name + "_push",
            displayName: name,
            scorers: pScorers,
        });
    const fsa = fingerprintScoringAspect(
        {
            name,
            displayName: name,
            scorers: fScorers,
        });
    return [fsa, psa];
}