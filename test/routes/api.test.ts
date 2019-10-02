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

import { Aspect } from "@atomist/sdm-pack-fingerprint";
import * as assert from "assert";
import { aspectSpecifiesNoEntropy } from "../../lib/routes/api";

describe("checking aspect for entropiness", () => {
    it("returns true if the aspect specified no entropy", () => {
        const aspect: Partial<Aspect<any>> = {
            stats: {
                defaultStatStatus: {
                    entropy: false,
                },
            },
        };
        const result = aspectSpecifiesNoEntropy(aspect as Aspect<any>);

        assert.strictEqual(result, true);

    });
});
