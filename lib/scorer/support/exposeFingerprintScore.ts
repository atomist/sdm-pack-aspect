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
