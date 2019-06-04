import { InMemoryTreesMerge, runReports } from "../lib/api/reporting";
import { featureManager } from "../lib/routes/features";
import { analysisResultStore } from "../lib/machine/machine";
import { allFingerprints } from "../lib/feature/DefaultFeatureManager";

import * as _ from "lodash";

describe("reporting", () => {

    it("runs reports", async () => {
        const repos = (await analysisResultStore.loadAll()).map(ar => ar.analysis);
        const tm = new InMemoryTreesMerge();
        await runReports(featureManager,
            repos,
            tm,
            _.uniq(allFingerprints(repos).map(fp => fp.name)),
            50,
        );
        console.log(Object.getOwnPropertyNames(tm.trees) + " trees");
    });

});
