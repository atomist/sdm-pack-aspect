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
    NoParameters,
    ProjectReview,
    ReviewComment,
} from "@atomist/automation-client";
import { ReviewerRegistration } from "@atomist/sdm";
import {
    Aspect, fingerprintOf, FP,
} from "@atomist/sdm-pack-fingerprint";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import { AspectMetadata, CountAspect } from "../compose/commonTypes";
import { ClassificationAspect, projectClassificationAspect } from "../compose/classificationAspect";

export type EligibleReviewer = ReviewerRegistration | CodeInspection<ProjectReview, NoParameters>;

/**
 * Emit fingerprint aspect, count aspect and classification aspect for the given review comment
 */
export function reviewerAspects(opts: AspectMetadata & {
    reviewer: EligibleReviewer,
}): Aspect[] {
    return [
        reviewCommentAspect(opts),
        reviewCommentCountAspect(opts),
        reviewCommentClassificationAspect(opts),
    ];
}

export function isReviewCommentFingerprint(fp: FP): fp is FP<ReviewComment> {
    const maybe = fp.data as ReviewComment;
    return !!maybe && !!maybe.subcategory && !!maybe.detail;
}

/**
 * Create fingerprints from the output of this reviewer.
 * Every fingerprint is unique
 */
function reviewCommentAspect(opts: AspectMetadata & {
    reviewer: EligibleReviewer,
}): Aspect<ReviewComment> {
    const inspection = isReviewerRegistration(opts.reviewer) ? opts.reviewer.inspection : opts.reviewer;
    return {
        ...opts,
        name: reviewCommentAspectName(opts.name),
        extract: async (p, pli) => {
            const result = await inspection(p, { ...pli, push: pli });
            if (!result) {
                return [];
            }
            return result.comments.map(data => {
                return fingerprintOf({
                    type: opts.name,
                    data,
                });
            });
        },
    };
}

function reviewCommentAspectName(name: string): string {
    return "instance_" + name;
}

function reviewCommentClassificationAspect(opts: AspectMetadata & {
    reviewer: EligibleReviewer,
}): ClassificationAspect {
    const requiredType = reviewCommentAspectName(opts.name);
    return projectClassificationAspect({
            name: `has_${opts.name}`,
            displayName: opts.displayName,
        },
        {
            tags: `has-${opts.name}`,
            reason: `Has review comment ${opts.name}`,
            testFingerprints: async fps => fps.some(fp => isReviewCommentFingerprint(fp) && fp.type === requiredType),
        });
}

function reviewCommentCountAspect(opts: AspectMetadata & {
    reviewer: EligibleReviewer,
}): CountAspect {
    const requiredType = reviewCommentAspectName(opts.name);
    return {
        name: `count_${opts.name}`,
        displayName: opts.displayName,
        extract: async () => [],
        consolidate: async fps => {
            const count = fps.filter(fp => isReviewCommentFingerprint(fp) && fp.type === requiredType).length;
            return fingerprintOf({
                type: "x",
                data: { count },
            });
        },
    };
}

function isReviewerRegistration(er: EligibleReviewer): er is ReviewerRegistration {
    const maybe = er as ReviewerRegistration;
    return !!maybe.inspection;
}
