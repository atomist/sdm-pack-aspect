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
