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
