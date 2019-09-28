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

import {
    logger,
    Project,
} from "@atomist/automation-client";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprint";
import {
    FiveStar,
    Score,
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

import * as _ from "lodash";

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
    return !!maybe && !!maybe.scoreFingerprints;
}

export function isPushScorer(scorer: AspectCompatibleScorer): scorer is PushScorer {
    const maybe = scorer as PushScorer;
    return !!maybe && !!maybe.scorePush;
}

export function isPushOrProjectScorer(scorer: AspectCompatibleScorer): scorer is (PushScorer | ProjectScorer) {
    const maybe = scorer as ProjectScorer;
    return !!maybe && !!maybe.scoreProject || isPushScorer(scorer);
}

export interface ScoringAspectOptions extends AspectMetadata {
    scorers: AspectCompatibleScorer[];
    scoreWeightings?: ScoreWeightings;
}

/**
 * Score this aspect based on projects, from low to high.
 * Requires no other fingerprints
 */
function scoringAspect(opts: ScoringAspectOptions): ScoredAspect {
    const pushScorers = opts.scorers.filter(isPushOrProjectScorer);
    return {
        extract: async (p, pili) => {
            // Just save these scores. They'll go into consolidate
            const scores = await pushAndProjectScoresFor(pushScorers, pili);
            (pili as any).scores = scores;
            return [];
        },
        consolidate: scoreBaseAndVirtualProjects(opts),
        ...ScoredAspectDefaults,
        ...opts,
    };
}

function scoreBaseAndVirtualProjects(opts: ScoringAspectOptions): (fingerprints: FP[], p: Project, pili: PushImpactListenerInvocation) => Promise<Array<FP<WeightedScore>>> {
    return async (fingerprints, p, pili) => {
        const repositoryScorers = opts.scorers.filter(isRepositoryScorer);
        const emittedFingerprints: Array<FP<WeightedScore>> = [];
        const repoToScore: RepoToScore = { analysis: { id: p.id, fingerprints } };

        const distinctNonRootPaths = _.uniq(repoToScore.analysis.fingerprints
            .map(fp => fp.path)
            .filter(p => !["", ".", undefined].includes(p)),
        );
        logger.info("Distinct non root paths for %s are %j", repoToScore.analysis.id.url, distinctNonRootPaths);

        for (const path of distinctNonRootPaths) {
            const scores = await fingerprintScoresFor(
                    repositoryScorers.filter(rs => !(rs.baseOnly || rs.scoreAll)),
                    withFingerprintsOnlyUnderPath(repoToScore, path));
            const scored: Scored = { scores };
            const weightedScore = weightedCompositeScore(scored, opts.scoreWeightings);
            emittedFingerprints.push(toFingerprint(opts.name, weightedScore, path));
        }

        const baseScorers = distinctNonRootPaths.length > 0 ?
            repositoryScorers.filter(rs => rs.baseOnly) :
            repositoryScorers;
        // Score under root
        const additionalScores = {
            ...await fingerprintScoresFor(baseScorers,
                withFingerprintsOnlyUnderPath(repoToScore, ""),
            ),
            ...await fingerprintScoresFor(baseScorers,
                withFingerprintsOnlyUnderPath(repoToScore, ".")),
            ...await fingerprintScoresFor(baseScorers,
                withFingerprintsOnlyUnderPath(repoToScore, undefined)),
            // Include ones without any filter
            ...await fingerprintScoresFor(baseScorers.filter(rs => rs.scoreAll),
                repoToScore),
            };
        const scores: Record<string, Score> = {
            ...additionalScores,
            ...(pili as any).scores,
        };
        // Add rollup of subprojects
        emittedFingerprints.forEach(ef => {
            scores[ef.path + "_" + ef.name] = {
                name: ef.path + "_" + ef.name,
                score: ef.data.weightedScore as FiveStar,
            };
        });
        const scored: Scored = { scores };
        const weightedScore = weightedCompositeScore(scored, opts.scoreWeightings);
        emittedFingerprints.push(toFingerprint(opts.name, weightedScore));

        return emittedFingerprints;
    };
}

function toFingerprint(type: string, data: WeightedScore, path?: string): FP<WeightedScore> {
    return {
        type,
        name: type,
        path,
        data,
        sha: sha256(JSON.stringify(data.weightedScore)),
    };
}

function withFingerprintsOnlyUnderPath(rts: RepoToScore, path: string): RepoToScore {
    return {
        analysis: {
            id: {
                ...rts.analysis.id,
                path,
            },
            fingerprints: rts.analysis.fingerprints.filter(fp => fp.path === path),
        },
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
