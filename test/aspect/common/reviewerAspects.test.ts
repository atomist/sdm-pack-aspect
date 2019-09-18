import { reviewCommentCountAspect } from "../../../lib/aspect/common/reviewerAspect";
import { InMemoryProject, NoParameters, ProjectReview } from "@atomist/automation-client";
import { CodeInspection } from "@atomist/sdm/lib/api/registration/CodeInspectionRegistration";
import * as assert from "assert";
import { CodeTransform } from "@atomist/sdm";
import { fingerprintOf } from "@atomist/sdm-pack-fingerprint";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";

const FlagNothingReviewer: CodeInspection<ProjectReview, NoParameters> = async p => ({
    repoId: p.id,
    comments: [],
});

const AddFileTerminator: CodeTransform<NoParameters> = async p => {
    await p.addFile("foo", "bar");
};

describe("reviewCount aspects", () => {

    describe("extract", () => {

        it("should find count 0", async () => {
            const ra = reviewCommentCountAspect({
                reviewer: FlagNothingReviewer,
                name: "clean",
                displayName: "clean",
            });
            const fps = toArray(await ra.consolidate([], undefined, undefined));
            assert.strictEqual(fps.length, 1);
            assert.strictEqual(fps[0].data.count, 0);
        });
    });

    describe("apply", () => {

        it("should not emit apply function by default", async () => {
            const ra = reviewCommentCountAspect({
                reviewer: FlagNothingReviewer,
                name: "clean",
                displayName: "clean",
            });
            assert.strictEqual(ra.apply, undefined);
        });

        it("should emit apply function when terminator provided", async () => {
            const ra = reviewCommentCountAspect({
                reviewer: FlagNothingReviewer,
                name: "clean",
                displayName: "clean",
                terminator: AddFileTerminator,
            });
            assert(!!ra.apply);
        });

        it("apply function should reject non-zero target", async () => {
            const ra = reviewCommentCountAspect({
                reviewer: FlagNothingReviewer,
                name: "clean",
                displayName: "clean",
                terminator: AddFileTerminator,
            });
            const nonZeroFp = fingerprintOf({
                type: "clean",
                data: { count: 666 },
            });
            try {
                await ra.apply(InMemoryProject.of(), { parameters: { fp: nonZeroFp } } as any);
                assert.fail("Should have died");
            } catch {
                // Ok
            }
        });

        it("apply function should run with zero target", async () => {
            const ra = reviewCommentCountAspect({
                reviewer: FlagNothingReviewer,
                name: "clean",
                displayName: "clean",
                terminator: AddFileTerminator,
            });
            const zeroFp = fingerprintOf({
                type: "clean",
                data: { count: 0 },
            });
            const p = InMemoryProject.of();
            await ra.apply(p, { parameters: { fp: zeroFp } } as any);
            assert(await p.hasFile("foo"));
        });

    });

});
