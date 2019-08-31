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

import { FP } from "@atomist/sdm-pack-fingerprints";
import * as assert from "assert";

// Don't let it remove typecasts
// tslint:disable

describe("classification aspects", () => {

    describe("project classification aspect", () => {

        it("no classifiers means no tags", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp, undefined);
        });

        it("one classifier produces no tags", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: "ouch", test: async () => false, reason: "wow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp, undefined);
        });

        it("one classifier produces an empty fingerprint with alwaysFingerprint", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x", alwaysFingerprint: true },
                { tags: "ouch", test: async () => false, reason: "wow" });
            const fp = await ca.extract(p, undefined) as FP<ClassificationData>;
            assert.strictEqual(fp.type, "foo");
            assert.deepStrictEqual(fp.data, { tags: [], reasons: [] });
        });

        it("one classifier produces one tag", async () => {
            const p = InMemoryProject.of();
            const ca = projectClassificationAspect({ name: "foo", displayName: "x" },
                { tags: "ouch", test: async () => true, reason: "wow" });
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

    });

});
