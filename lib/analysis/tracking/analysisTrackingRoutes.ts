
import { logger } from "@atomist/automation-client";
import { AnalysisTrackingPage } from "../../../views/analysisTrackingPage";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { WebAppConfig } from "../../routes/web-app/webAppConfig";

export function exposeAnalysisTrackingPage(conf: WebAppConfig): void {
    conf.express.get("/analysis", ...conf.handlers, async (req, res) => {
        try {
            const data = conf.analysisTracking.report();

            res.send(renderStaticReactNode(
                AnalysisTrackingPage(data), `Analyzing projects`,
                conf.instanceMetadata));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send("failure");
        }
    });
}
