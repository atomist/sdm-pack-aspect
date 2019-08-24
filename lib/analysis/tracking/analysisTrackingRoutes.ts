
import { logger } from "@atomist/automation-client";
import {
    Express,
    RequestHandler,
} from "express";
import { AnalysisTrackingPage } from "../../../views/analysisTrackingPage";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { AnalysisTracking } from "./analysisTracker";

export function exposeAnalysisTrackingPage(express: Express,
                                           handlers: RequestHandler[],
                                           analysisTracking: AnalysisTracking): void {
    express.get("/analysis", ...handlers, async (req, res) => {
        try {
            const data = analysisTracking.report();

            res.send(renderStaticReactNode(
                AnalysisTrackingPage(data), `Analyzing projects`));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send("failure");
        }
    });
}
