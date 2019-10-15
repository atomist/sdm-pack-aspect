import { PostgresProjectAnalysisResultStore } from "../lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { sdmConfigClientFactory } from "../lib/analysis/offline/persist/pgClientFactory";
import * as assert from "power-assert";
import { ProjectAnalysisResult } from "../lib/analysis/ProjectAnalysisResult";
import { FP } from "@atomist/sdm-pack-fingerprint";

describe("Postgres Result Store", () => {
    it("does something", async () => {
        const subject = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory({}));


        const workspaceId = "TJVC";
        const fingerprintToStore: FP<any> = {
            type: "MST3k",
            name: "Rowsdower",
            displayName: "The Loyal Traitor",
            sha: "8x4d",
            data: { yell: "ROWSDOWER!!!" }
        }
        const repoRef = {
            owner: "satellite-of-love",
            repo: "rowsdower",
            url: "https://github.com/satellite-of-love/rowsdower",
            sha: "dead0x",
        };
        const analysis: ProjectAnalysisResult = {
            repoRef,
            workspaceId,
            timestamp: new Date(),
            analysis: {
                id: repoRef,
                fingerprints: [fingerprintToStore]
            }
        };

        const persistResult = await subject.persist(analysis);

        console.log(persistResult);

        assert.strictEqual(persistResult.failed.length, 0, "Failures: " + persistResult.failed.map(f => f.message).join(", "));
        assert.strictEqual(persistResult.failedFingerprints.length, 0,
            "Failures: " + persistResult.failedFingerprints.map(f => f.error).join(", "));
        assert(persistResult.succeeded.length > 0, "reports something was persisted");
    })
})