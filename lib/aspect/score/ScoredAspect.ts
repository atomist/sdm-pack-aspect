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
    Scorer,
    ScorerReturn,
    Scores,
    ScoreWeightings,
    weightedCompositeScore,
    WeightedScore,
} from "../../scorer/Score";
import { starBand } from "../../util/commonBands";
import {
    RepositoryScorer,
    RepoToScore,
} from "../AspectRegistry";
import { AspectMetadata } from "../compose/commonTypes";

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
export interface PushScorer extends Scorer {
    scorePush: (pili: PushImpactListenerInvocation) => Promise<ScorerReturn>;
}

/**
 * Default properties to configure ScoredAspect
 */
export const ScoredAspectDefaults: Pick<ScoredAspect, "stats" | "toDisplayableFingerprint"> = {
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
export interface ProjectScorer extends Scorer {

    scoreProject: (p: Project) => Promise<ScorerReturn>;
}

/**
 * Scorer that can be used in an aspect
 */
export type AspectCompatibleScorer = RepositoryScorer | ProjectScorer | PushScorer;

export function isRepositoryScorer(s: AspectCompatibleScorer): s is RepositoryScorer {
    const maybe = s as RepositoryScorer;
    return !!maybe.scoreFingerprints;
}

export function isPushScorer(scorer: AspectCompatibleScorer): scorer is PushScorer {
    const maybe = scorer as PushScorer;
    return !!maybe.scorePush;
}

export function isPushOrProjectScorer(scorer: AspectCompatibleScorer): scorer is (PushScorer | ProjectScorer) {
    const maybe = scorer as ProjectScorer;
    return !!maybe.scoreProject || isPushScorer(scorer);
}

/**
 * Score this aspect based on projects, from low to high.
 * Requires no other fingerprints
 */
function scoringAspect(
    opts: {
        scorers: AspectCompatibleScorer[],
        scoreWeightings?: ScoreWeightings,
    } & AspectMetadata): ScoredAspect {
    const pushScorers = opts.scorers.filter(isPushOrProjectScorer);
    const repositoryScorers = opts.scorers.filter(isRepositoryScorer);
    return {
        extract: async (p, pili) => {
            // Just save these scores. They'll go into consolidate
            const scores = await pushAndProjectScoresFor(pushScorers, pili);
            (pili as any).scores = scores;
            return [];
        },
        consolidate: async (fingerprints, p, pili) => {
            const repoToScore: RepoToScore = { analysis: { id: p.id, fingerprints } };
            const additionalScores = await fingerprintScoresFor(repositoryScorers, repoToScore);
            const scores = {
                ...additionalScores,
                ...(pili as any).scores,
            };
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

async function pushAndProjectScoresFor(pushScorers: Array<PushScorer | ProjectScorer>,
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

export function emitScoringAspect(name: string,
                                  scorers: AspectCompatibleScorer[],
                                  scoreWeightings: ScoreWeightings): ScoredAspect | undefined {
    return scorers.length > 0 ?
        scoringAspect(
            {
                name,
                displayName: `Scores for ${name}`,
                scorers,
                scoreWeightings,
            }) :
        undefined;
}
