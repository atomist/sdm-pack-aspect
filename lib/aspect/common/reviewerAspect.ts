import { ReviewerRegistration } from "@atomist/sdm";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprint";
import { NoParameters, ProjectReview, ReviewComment } from "@atomist/automation-client";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import { AspectMetadata } from "../compose/commonTypes";

export type EligibleReviewer = ReviewerRegistration | CodeInspection<ProjectReview, NoParameters>;

/**
 * Create fingerprints from the output of this reviewer
 */
export function reviewerAspect(opts: AspectMetadata & {
    reviewer: EligibleReviewer
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
                return fingerprintOf({
                    type: opts.name,
                    data,
                });
            });
        }
    };
}

function isReviewerRegistration(er: EligibleReviewer): er is ReviewerRegistration {
    const maybe = er as ReviewerRegistration;
    return !!maybe.inspection;
}