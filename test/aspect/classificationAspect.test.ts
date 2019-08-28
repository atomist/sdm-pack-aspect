import { InMemoryProject } from "@atomist/automation-client";
import { classificationAspect, ClassificationData } from "../../lib/aspect/compose/classificationAspect";

import * as assert from "assert";
import { FP } from "@atomist/sdm-pack-fingerprints";

// Don't let it remove typecasts
// tslint:disable

describe("classification aspect", () => {

    it("no classifiers means no tags", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp, undefined);
    });

    it("one classifier produces no tags", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x" },
            { tags: "ouch", test: async () => false, reason: "wow" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp, undefined);
    });

    it("one classifier produces an empty fingerprint with alwaysFingerprint", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x", alwaysFingerprint: true },
            { tags: "ouch", test: async () => false, reason: "wow" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp.type, "foo");
        assert.deepStrictEqual(fp.data, { tags: [], reasons: [] });
    });

    it("one classifier produces one tag", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x" },
            { tags: "ouch", test: async () => true, reason: "wow" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp.type, "foo");
        assert.deepStrictEqual(fp.data, { tags: ["ouch"], reasons: ["wow"] });
    });

    it("one classifier produces two tags", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x" },
            { tags: ["ouch", "bang"], test: async () => true, reason: "wow" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp.type, "foo");
        assert.deepStrictEqual(fp.data, { tags: ["bang", "ouch"], reasons: ["wow"] });
    });

    it("one classifier produces two tags, another one", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x" },
            { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
            { tags: "badger", test: async () => true, reason: "meadow" });
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp.type, "foo");
        assert.deepStrictEqual(fp.data, { tags: ["badger", "bang", "ouch"], reasons: ["wow", "meadow"] });
    });

    it("one classifier produces two tags, another one: stopAtOne", async () => {
        const p = InMemoryProject.of();
        const ca = classificationAspect({ name: "foo", displayName: "x", stopAtFirst: true },
            { tags: "badger", test: async () => true, reason: "meadow" },
            { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
        );
        const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
        assert.strictEqual(fp.type, "foo");
        assert.deepStrictEqual(fp.data, { tags: ["badger"], reasons: ["meadow"] });
    });

});
