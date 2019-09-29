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

import { sha256 } from "@atomist/sdm-pack-fingerprint";
import { Language } from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import { RepositoryScorer } from "../aspect/AspectRegistry";
import { isCodeMetricsFingerprint } from "../aspect/common/codeMetrics";
import { findReviewCommentCountFingerprint } from "../aspect/common/reviewerAspect";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import {
    hasNoLicense,
    isLicenseFingerprint,
} from "../aspect/community/license";
import {
    countGlobMatches,
    isGlobMatchFingerprint,
} from "../aspect/compose/globAspect";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import { GitRecencyType } from "../aspect/git/gitActivity";
import {
    AlwaysIncludeCategory,
    FiveStar,
} from "./Score";
import { adjustBy } from "./scoring";

export const CommunityCategory: string = "community";

export const CodeCategory: string = "code";

/**
 * Use to anchor scores to penalize repositories about which we know little.
 * Typically weighted > default x1
 */
export function anchorScoreAt(score: FiveStar): RepositoryScorer {
    const scoreFingerprints = async () => {
        return {
            reason: `Weight to ${score} stars to penalize repositories about which we know little`,
            score,
        };
    };
    return {
        name: "anchor",
        category: AlwaysIncludeCategory,
        scoreFingerprints,
    };
}

/**
 * Penalize repositories for not having a recent commit.
 * days is the number of days since the latest commit to the default branch
 * that will cost 1 star.
 */
export function requireRecentCommit(opts: { days: number }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const grt = repo.analysis.fingerprints.find(fp => fp.type === GitRecencyType);
        if (!grt) {
            return undefined;
        }
        if (!grt.data.lastCommitTime) {
            return undefined;
        }
        const date = new Date(grt.data.lastCommitTime);
        const days = daysSince(date);
        return {
            score: adjustBy((1 - days) / (opts.days || 1)),
            reason: `Last commit ${days} days ago`,
        };
    };
    return {
        name: "recency",
        scoreFingerprints,
        baseOnly: true,
    };
}

/**
 * Limit languages used in a project
 */
export function limitLanguages(opts: { limit: number, baseOnly?: boolean }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const cm = repo.analysis.fingerprints.find(isCodeMetricsFingerprint);
        if (!cm) {
            return undefined;
        }
        return {
            score: adjustBy(opts.limit - cm.data.languages.length),
            reason: `Found ${cm.data.languages.length} languages: ${cm.data.languages.map(l => l.language.name).join(",")}`,
        };
    };
    return {
        name: "multi-language",
        scoreFingerprints,
        baseOnly: opts.baseOnly,
    };
}

/**
 * Penalize repositories for having too many lines of code.
 * The limit is the number of lines of code required to drop one star.
 * The chosen limit will depend on team preferences: For example,
 * are we trying to do microservices?
 */
export function limitLinesOfCode(opts: { limit: number, baseOnly?: boolean }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const cm = repo.analysis.fingerprints.find(isCodeMetricsFingerprint);
        if (!cm) {
            return undefined;
        }
        return {
            score: adjustBy(-cm.data.lines / opts.limit),
            reason: `Found ${cm.data.lines} total lines of code`,
        };
    };
    return {
        name: "total-loc",
        category: CodeCategory,
        scoreFingerprints,
        baseOnly: opts.baseOnly,
    };
}

/**
 * Penalize repositories for having too many lines of code in the given language
 */
export function limitLinesOfCodeIn(opts: { limit: number, language: Language, freeAmount?: number }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const cm = repo.analysis.fingerprints.find(isCodeMetricsFingerprint);
        if (!cm) {
            return undefined;
        }
        const target = cm.data.languages.find(l => l.language.name === opts.language.name);
        const targetLoc = target ? target.total : 0;
        return {
            score: adjustBy(((opts.freeAmount || 0) - targetLoc) / opts.limit),
            reason: `Found ${targetLoc} lines of ${opts.language.name}`,
        };
    };
    return {
        name: `limit-${opts.language.name} (${opts.limit})`,
        scoreFingerprints,
    };
}

/**
 * Penalize repositories for having an excessive number of git branches
 */
export function penalizeForExcessiveBranches(opts: { branchLimit: number }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const branchCount = repo.analysis.fingerprints.find(f => f.type === BranchCountType);
        if (!branchCount) {
            return undefined;
        }
        // You get the first 2 branches for free. After that they start to cost
        const score = adjustBy(-(branchCount.data.count - 2) / opts.branchLimit);
        return branchCount ? {
            score,
            reason: `${branchCount.data.count} branches: Should not have more than ${opts.branchLimit}`,
        } : undefined;
    };
    return {
        name: BranchCountType,
        scoreFingerprints,
        baseOnly: true,
    };
}

/**
 * Penalize repositories for having more than 1 virtual project,
 * as identified by a VirtualProjectFinder
 */
export const PenalizeMonorepos: RepositoryScorer = {
    scoreFingerprints: async repo => {
        const distinctPaths = _.uniq(repo.analysis.fingerprints.map(t => t.path)).length;
        return {
            score: adjustBy(1 - distinctPaths / 2),
            reason: distinctPaths > 1 ?
                `${distinctPaths} virtual projects: Prefer one project per repository` :
                "Single project in repository",
        };

    },
    name: "monorepo",
    scoreAll: true,
};

/**
 * Penalize repositories without a license file
 */
export const PenalizeNoLicense: RepositoryScorer = {
    name: "require-license",
    category: CommunityCategory,
    baseOnly: true,
    scoreFingerprints: async repo => {
        const license = repo.analysis.fingerprints.find(isLicenseFingerprint);
        const bad = !license || hasNoLicense(license.data);
        return {
            score: bad ? 1 : 5,
            reason: bad ? "Repositories should have a license" : "Repository has a license",
        };
    },
};

/**
 * Penalize repositories without a code of conduct file
 */
export const PenalizeNoCodeOfConduct: RepositoryScorer =
    requireAspectOfType({
        type: CodeOfConductType,
        category: CommunityCategory,
        reason: "Repos should have a code of conduct",
        baseOnly: true,
    });

/**
 * Penalize repositories that don't have this type of aspect.
 * If data is provided, check that the sha matches the default sha-ing of this
 * data payload
 */
export function requireAspectOfType(opts: {
    type: string,
    reason: string,
    data?: any,
    category?: string,
    baseOnly?: boolean,
}): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const found = repo.analysis.fingerprints.find(fp => fp.type === opts.type &&
            (opts.data ? fp.sha === sha256(JSON.stringify(opts.data)) : true));
        const score: FiveStar = !!found ? 5 : 1;
        return {
            score,
            reason: !found ? opts.reason : "Satisfactory",
        };
    };
    return {
        name: `${opts.type}-required`,
        category: opts.category,
        scoreFingerprints,
        baseOnly: opts.baseOnly,
    };
}

/**
 * Penalize repositories without matches for the glob pattern.
 * Depends on globAspect
 */
export function requireGlobAspect(opts: { glob: string, category?: string, baseOnly?: boolean }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const globs = repo.analysis.fingerprints.filter(isGlobMatchFingerprint);
        const found = globs
            .filter(gf => gf.data.glob === opts.glob)
            .filter(f => f.data.matches.length > 0);
        const score: FiveStar = !!found ? 5 : 1;
        return {
            score,
            reason: !found ? `Should have file for ${opts.glob}` : "Satisfactory",
        };
    };
    return {
        name: `${opts.glob}-required`,
        category: opts.category,
        scoreFingerprints,
        baseOnly: opts.baseOnly,
    };
}

/**
 * Penalize for each point lost in these reviewers
 */
export function penalizeForReviewViolations(opts: { reviewerName: string, violationsPerPointLost: number }): RepositoryScorer {
    return {
        name: opts.reviewerName,
        scoreFingerprints: async repo => {
            const found = findReviewCommentCountFingerprint(opts.reviewerName, repo.analysis.fingerprints);
            const count = !!found ? found.data.count : 0;
            const score = !!found ? adjustBy(count / opts.violationsPerPointLost) : 5;
            return {
                score,
                reason: `${count} review comments found for ${opts.reviewerName}`,
            };
        },
    };
}

/**
 * Convenient function to emit scorers for all reviewers
 */
export function penalizeForAllReviewViolations(opts: { reviewerNames: string[], violationsPerPointLost: number }): RepositoryScorer[] {
    return opts.reviewerNames.map(reviewerName => penalizeForReviewViolations({
        reviewerName,
        violationsPerPointLost: opts.violationsPerPointLost,
    }));
}

/**
 * Use for a file pattern or something within files we don't want
 */
export function penalizeGlobMatches(opts: { name?: string, type: string, pointsLostPerMatch: number }): RepositoryScorer {
    const scoreFingerprints = async repo => {
        const count = countGlobMatches(repo.analysis.fingerprints, opts.type);
        const score = adjustBy(-count * opts.pointsLostPerMatch);
        return {
            score,
            reason: `${count} matches for glob typed ${opts.type}: Should have none`,
        };
    };
    return {
        name: opts.name || opts.type,
        scoreFingerprints,
    };
}
