import { ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import * as assert from "assert";
import { ProjectAnalysisResultStore } from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { ScmSearchCriteria } from "../../../lib/analysis/offline/spider/ScmSearchCriteria";
import { SpiderOptions, SpiderResult } from "../../../lib/analysis/offline/spider/Spider";
import { ProjectAnalysisResult } from "../../../lib/analysis/ProjectAnalysisResult";
import { GitHubSearchResult, GitHubSpider } from "./../../../lib/analysis/offline/spider/github/GitHubSpider";

describe("GithubSpider", () => {
    it("gives empty results when query returns empty", async () => {
        const subject = new GitHubSpider(async function*(t, q) { });

        const result = await subject.spider(undefined, undefined, undefined);

        const expected: SpiderResult = { detectedCount: 0, failed: [] };

        assert.deepStrictEqual(result, expected);
    });

    it("gives a result when query returns one", async () => {
        // this function is pretty darn elaborate

        const one: GitHubSearchResult = {
            owner: { login: "me" },
            name: "hi",
            url: "https://home",
        } as GitHubSearchResult;

        const oneResult: ProjectAnalysisResult = {

        } as ProjectAnalysisResult;

        const criteria: ScmSearchCriteria = {
            githubQueries: [],
            maxRetrieved: 10,
            maxReturned: 10,
        };
        const analyzer: ProjectAnalyzer = {

        } as ProjectAnalyzer;
        const opts: SpiderOptions = {
            persister: { load: async rr => oneResult } as ProjectAnalysisResultStore,
            keepExistingPersisted: async r => false,
            poolSize: 3,
        };

        const subject = new GitHubSpider(async function*(t, q) { yield one; });

        const result = await subject.spider(criteria, analyzer, opts);

        const expected: SpiderResult = { detectedCount: 0, failed: [] };

        assert.deepStrictEqual(result, expected);
    });
});
