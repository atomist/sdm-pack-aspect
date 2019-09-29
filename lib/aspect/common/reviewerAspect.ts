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
    logger,
    NoParameters,
    ProjectReview,
    ReviewComment,
} from "@atomist/automation-client";
import {
    CodeTransform,
    ReviewerRegistration,
} from "@atomist/sdm";
import {
    ApplyFingerprint,
    Aspect,
    fingerprintOf,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import {
    ClassificationAspect,
    projectClassificationAspect,
} from "../compose/classificationAspect";
import {
    AspectMetadata,
    CountAspect,
    CountData,
} from "../compose/commonTypes";
import { distinctNonRootPaths } from "../../util/fingerprintUtils";

export type EligibleReviewer = ReviewerRegistration | CodeInspection<ProjectReview, NoParameters>;

export interface ReviewerAspectOptions extends AspectMetadata {

    /**
     * Reviewer that can provide the fingerprint
     */
    readonly reviewer: EligibleReviewer;

    /**
     * Code transform that can remove usages of this problematic fingerprint
     */
    readonly terminator?: CodeTransform<NoParameters>;

    /**
     * Do we want classification for this aspect
     */
    readonly emitClassifier?: boolean;

    /**
     * If provided, causes classification to take place and specifies a custom tag.
     * Otherwise tag will default to name passed into reviewerAspects
     */
    readonly tag?: string;

    /**
     * If provided, resolve the virtual project path
     */
    virtualProjectPathResolver?: (path: string) => string;
}

/**
 * Emit fingerprint aspect, count aspect and classification aspect for the given review comment.
 * If a terminator CodeTransform is provided, it will try to delete all instances of the fingerprint
 */
export function reviewerAspects(opts: ReviewerAspectOptions): Aspect[] {
    const aspects: Aspect[] = [
        reviewCommentAspect(opts),
        reviewCommentCountAspect(opts),
    ];
    if (opts.emitClassifier || opts.tag) {
        aspects.push(reviewCommentClassificationAspect(opts));
    }
    return aspects;
}

export function isReviewCommentFingerprint(fp: FP): fp is FP<ReviewComment> {
    const maybe = fp.data as ReviewComment;
    return !!maybe && !!maybe.subcategory && !!maybe.detail;
}

/**
 * Create fingerprints from the output of this reviewer.
 * Every fingerprint is unique
 */
export function reviewCommentAspect(opts: ReviewerAspectOptions): Aspect<ReviewComment> {
    const inspection = isReviewerRegistration(opts.reviewer) ? opts.reviewer.inspection : opts.reviewer;
    const type = reviewCommentAspectName(opts.name);
    return {
        ...opts,
        name: type,
        extract: async (p, pli) => {
            const result = await inspection(p, { ...pli, push: pli });
            if (!result) {
                return [];
            }
            return result.comments.map(data => {
                return fingerprintOf({
                    type,
                    data,
                    path: (!!opts.virtualProjectPathResolver && !!data.sourceLocation) ?
                        opts.virtualProjectPathResolver(data.sourceLocation.path) :
                        undefined,
                });
            });
        },
    };
}

function reviewCommentAspectName(name: string): string {
    return "instance_" + name;
}

function reviewCommentClassificationAspect(opts: ReviewerAspectOptions): ClassificationAspect {
    const requiredType = reviewCommentAspectName(opts.name);
    return projectClassificationAspect({
            name: `has_${opts.name}`,
            displayName: opts.displayName,
        },
        {
            tags: opts.tag || `has-${opts.name}`,
            reason: `Has review comment ${opts.name}`,
            testFingerprints: async fps => fps.some(fp => isReviewCommentFingerprint(fp) && fp.type === requiredType),
        });
}

/**
 * Count the problematic usage and delete it if necessary
 * @param {ReviewerAspectOptions} opts
 * @return {CountAspect}
 */
export function reviewCommentCountAspect(opts: ReviewerAspectOptions): CountAspect {
    const requiredType = reviewCommentAspectName(opts.name);
    const type = countFingerprintTypeFor(opts.name);
    return {
        name: type,
        displayName: opts.displayName,
        extract: async () => [],
        consolidate: async fps => {
            const relevantFingerprints = fps.filter(fp => isReviewCommentFingerprint(fp) && fp.type === requiredType);
            const toEmit: Array<FP<CountData>> = [];
            // Always put the full count on the root
            toEmit.push(fingerprintOf({
                type,
                data: { count: relevantFingerprints.length },
            }));
            // Fingerprint each subproject distinctly with its own count
            const nonRootPaths = distinctNonRootPaths(relevantFingerprints);
            for (const path of nonRootPaths) {
                toEmit.push(fingerprintOf({
                    type,
                    data: { count: relevantFingerprints.filter(fp => fp.path === path).length },
                    path,
                }));
            }
            return toEmit;
        },
        apply: opts.terminator ? terminateWithExtremePrejudice(opts) : undefined,
    };
}

function countFingerprintTypeFor(name: string): string {
    return `count_${name}`;
}

export function findReviewCommentCountFingerprint(name: string, fps: FP[]): FP<CountData> | undefined {
    const type = countFingerprintTypeFor(name);
    return fps.find(fp => fp.type === type);
}

function terminateWithExtremePrejudice(opts: ReviewerAspectOptions): ApplyFingerprint {
    return async (p, pi) => {
        const to = pi.parameters.fp;
        if (to.data.count !== 0) {
            const msg = `Doesn't make sense to keep a non-zero number of fingerprints in ${opts.name}`;
            logger.warn(msg);
            return { target: p, success: false, error: new Error(msg) };
        }
        return opts.terminator(p, pi);
    };
}

function isReviewerRegistration(er: EligibleReviewer): er is ReviewerRegistration {
    const maybe = er as ReviewerRegistration;
    return !!maybe.inspection;
}
