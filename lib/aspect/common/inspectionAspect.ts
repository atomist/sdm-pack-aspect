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

import { logger, NoParameters, ProjectReview, ReviewComment, } from "@atomist/automation-client";
import { CodeTransform, ReviewerRegistration, } from "@atomist/sdm";
import { ApplyFingerprint, Aspect, FP, sha256, } from "@atomist/sdm-pack-fingerprint";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import { AspectMetadata, } from "../compose/commonTypes";

export type EligibleReviewer = ReviewerRegistration | CodeInspection<ProjectReview, NoParameters>;

export interface InspectionAspectOptions extends AspectMetadata {

    /**
     * Reviewer that can provide the fingerprint
     */
    readonly reviewer: EligibleReviewer;

    /**
     * Code transform that can remove usages of this problematic fingerprint
     */
    readonly terminator?: CodeTransform<NoParameters>;

}

export interface InspectionAspectData {
    magnitude: number;
    comments: ReviewComment[];
}

export function isInspectionFingerprint(fp: FP): fp is FP<InspectionAspectData> {
    return !!fp.data && !!fp.data.magnitude && !!fp.data.comments;
}

/**
 * Create fingerprints from the output of this reviewer.
 * Every fingerprint is unique
 */
export function inspectionAspect(opts: InspectionAspectOptions): Aspect<InspectionAspectData> {
    const inspection = isReviewerRegistration(opts.reviewer) ? opts.reviewer.inspection : opts.reviewer;
    const type = opts.name;
    return {
        ...opts,
        name: type,
        extract: async (p, pli) => {
            const result = await inspection(p, { ...pli, push: pli });
            if (!result) {
                return [];
            }
            const magnitude = result.comments.length;
            return {
                type,
                name: type,
                data: {
                    comments: result.comments,
                    magnitude,
                },
                sha: sha256({ magnitude }),
            };
        },
        apply: opts.terminator ? terminateWithExtremePrejudice(opts) : undefined,
    };
}

function terminateWithExtremePrejudice(opts: InspectionAspectOptions): ApplyFingerprint {
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
