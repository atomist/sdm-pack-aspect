import { PostgresProjectAnalysisResultStore } from "../lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { sdmConfigClientFactory } from "../lib/analysis/offline/persist/pgClientFactory";
import * as assert from "power-assert";
import { ProjectAnalysisResult } from "../lib/analysis/ProjectAnalysisResult";

describe("Postgres Result Store", () => {
    it("does something", async () => {

        const subject = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory({}));

        const analysis: ProjectAnalysisResult = {} as any;

        const persistResult = await subject.persist(analysis);

        assert(persistResult.succeeded, "woo, a method");
    })
})