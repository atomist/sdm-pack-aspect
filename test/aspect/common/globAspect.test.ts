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
    InMemoryProject,
    Project,
} from "@atomist/automation-client";
import {
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import {
    globAspect,
    GlobAspectData,
} from "../../../lib/aspect/compose/globAspect";

import * as assert from "assert";

describe("glob aspect", () => {

    it("should find none in empty project", async () => {
        const ga = globAspect({ name: "foo", glob: "thing", displayName: "" });
        const fp = await extractify(ga, InMemoryProject.of());
        assert.strictEqual(fp.data.matches.length, 0);
    });

    it("should find one with no content test", async () => {
        const ga = globAspect({ name: "foo", glob: "thing", displayName: "" });
        const fp = await extractify(ga, InMemoryProject.of({ path: "thing", content: "x" }));
        assert.strictEqual(fp.data.matches.length, 1);
        assert.strictEqual(fp.data.matches[0].path, "thing");
    });

    it("should find none with content test", async () => {
        const ga = globAspect({ name: "foo", glob: "thing", displayName: "", contentTest: () => false });
        const fp = await extractify(ga, InMemoryProject.of({ path: "thing", content: "x" }));
        assert.strictEqual(fp.data.matches.length, 0);
    });

    it("should add custom data to match", async () => {
        const ga = globAspect<{color: string}>({
            name: "foo", glob: "thing", displayName: "",
            extract: async content => ({ color: "yellow" }),
        });
        const fp = await extractify<{color: string}>(ga, InMemoryProject.of({ path: "thing", content: "x" }));
        assert.strictEqual(fp.data.matches.length, 1);
        assert.strictEqual(fp.data.matches[0].path, "thing");
        assert.strictEqual(fp.data.matches[0].color, "yellow");
    });

});

async function extractify<D>(ga: Aspect<GlobAspectData>, p: Project): Promise<FP<GlobAspectData<D>>> {
    return ga.extract(p, undefined) as any;
}
