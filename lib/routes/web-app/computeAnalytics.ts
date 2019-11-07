import { Aspect } from "@atomist/sdm-pack-fingerprint";
import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalytics } from "../../analysis/offline/spider/analytics";
import { WebAppConfig } from "./webAppConfig";

export function supportComputeAnalyticsButton(conf: WebAppConfig,
                                              analyzer: {
        aspectOf(aspectName: string): Aspect<any> | undefined,
    },
                                              persister: ProjectAnalysisResultStore) {
    conf.express.post("/computeAnalytics", ...conf.handlers, async (req, res, next) => {
        try {
            // Ideally we'd do this in the background somehow
            // but ideally, we'd have a proper React page call this.
            await computeAnalytics({ persister, analyzer }, "local");
            res.send(`Great! You have recomputed analytics across repositories. Hopefully the <a href="/overview">Overview</a> will be up to date now`);
        } catch (e) {
            next(e);
        }
    });
}
