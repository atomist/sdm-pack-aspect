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

import { InMemoryProject } from "@atomist/automation-client";
import {
    ClassificationData,
    projectClassificationAspect,
} from "../../lib/aspect/compose/classificationAspect";

import { fingerprintOf, FP } from "@atomist/sdm-pack-fingerprint";
import * as assert from "assert";

// Don't let it remove typecasts
// tslint:disable

describe("classification aspects", () => {

    describe("project classification aspect", () => {

        it("no classifiers means no tags", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.deepStrictEqual(fp.data.tags, []);
        });

        it("one classifier produces no tags", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: "ouch", test: async () => false, reason: "wow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.deepStrictEqual(fp.data.tags, []);
        });

        it("one classifier produces one tag", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: "ouch", test: async () => true, reason: "wow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["ouch"], reasons: ["wow"] });
        });

        it("doesn't run unnecessary classifier", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: "ouch", test: async () => true, reason: "wow" },
                {
                    tags: "ouch", test: async () => {
                        throw new Error("should not get here")
                    }, reason: "wow"
                });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["ouch"], reasons: ["wow"] });
        });

        it("one classifier produces two tags", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["bang", "ouch"], reasons: ["wow"] });
        });

        it("one classifier produces two tags, another one", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
                { tags: "badger", test: async () => true, reason: "meadow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["badger", "bang", "ouch"], reasons: ["wow", "meadow"] });
        });

        it("one classifier produces two tags, another one: stopAtOne", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x", stopAtFirst: true },
                { tags: "badger", test: async () => true, reason: "meadow" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
            );
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["badger"], reasons: ["meadow"] });
        });

        it("derived classifier that always matches", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x", stopAtFirst: true },
                { tags: "badger", testFingerprints: async () => true, reason: "meadow" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
            );
            const fp = await ca.consolidate([], p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["badger"], reasons: ["meadow"] });
        });

        it("derived classifier that takes from a fingerprint", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x", stopAtFirst: true },
                { tags: "badger", testFingerprints: async fps => fps.length === 1, reason: "meadow" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
            );
            const passedFp = fingerprintOf({ type: "foo", data: { here: true } });
            const fp = await ca.consolidate([passedFp], p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: ["badger"], reasons: ["meadow"] });
        });

        it("derived classifier that doesn't take from a fingerprint", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x", stopAtFirst: true },
                { tags: "badger", testFingerprints: async fps => fps.length === 3879, reason: "meadow" },
                { tags: ["ouch", "bang"], test: async () => true, reason: "wow" },
            );
            const passedFp = fingerprintOf({ type: "foo", data: { here: true } });
            const fp = await ca.consolidate([passedFp], p, undefined) as FP<ClassificationData>;
            assert.deepStrictEqual(fp.data.tags, []);
        });

    });

});
