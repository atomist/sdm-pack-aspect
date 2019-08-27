import { Express, RequestHandler } from "express-serve-static-core";

import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";

import { ExtensionPackMetadata } from "@atomist/sdm";

import { HttpClientFactory } from "@atomist/automation-client";

import { AnalysisTracking } from "../../analysis/tracking/analysisTracker";
import { AspectRegistry } from "../../aspect/AspectRegistry";

export interface WebAppConfig {
    express: Express;
    handlers: RequestHandler[];
    aspectRegistry: AspectRegistry;
    store: ProjectAnalysisResultStore;
    instanceMetadata: ExtensionPackMetadata;
    httpClientFactory: HttpClientFactory;
    analysisTracking: AnalysisTracking;
}
