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

import * as assert from "assert";
import { SpiderResult } from "../../../lib/analysis/offline/spider/Spider";
import { GitHubSearchResult, GitHubSpider } from "./../../../lib/analysis/offline/spider/github/GitHubSpider";

describe("GithubSpider", () => {
    it("gives empty results when query returns empty", async () => {
        const subject = new GitHubSpider(async function*(t, q) { });

        const result = await subject.spider(undefined, undefined, undefined);

        const expected: SpiderResult = { detectedCount: 0, failed: [] };

        assert.deepStrictEqual(result, expected);
    });

    it.skip("gives a result when query returns one", async () => {
        // this function is pretty darn elaborate

        const one: GitHubSearchResult = {
            owner: { login: "me" },
            name: "hi",
            url: "https://home",
        } as GitHubSearchResult;

        const subject = new GitHubSpider(async function*(t, q) { yield one; });

        const result = await subject.spider(undefined, undefined, undefined);

        const expected: SpiderResult = { detectedCount: 0, failed: [] };

        assert.deepStrictEqual(result, expected);
    });
});
