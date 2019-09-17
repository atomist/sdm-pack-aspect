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
    Aspect,
    sha256,
} from "@atomist/sdm-pack-fingerprint";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import { AspectMetadata } from "../compose/commonTypes";

export type EligibleReviewer = ReviewerRegistration | CodeInspection<ProjectReview, NoParameters>;

/**
 * Create fingerprints from the output of this reviewer
 */
export function reviewerAspect(opts: AspectMetadata & {
    reviewer: EligibleReviewer,
}): Aspect<ReviewComment> {
    const inspection = isReviewerRegistration(opts.reviewer) ? opts.reviewer.inspection : opts.reviewer;
    return {
        ...opts,
        extract: async (p, pli) => {
            const result = await inspection(p, { ...pli, push: pli });
            if (!result) {
                return [];
            }
            return result.comments.map(data => {
                const shaAble = {
                    detail: data.detail,
                    category: data.category,
                    subcategory: data.subcategory,
                };
                return {
                    type: opts.name,
                    name: opts.name,
                    data,
                    sha: sha256(JSON.stringify(shaAble)),
                };
            });
        },
    };
}

function isReviewerRegistration(er: EligibleReviewer): er is ReviewerRegistration {
    const maybe = er as ReviewerRegistration;
    return !!maybe.inspection;
}
