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
import * as _ from "lodash";
import { AnalysisTrackingPage } from "../../../views/analysisTrackingPage";
import { AspectTrackingPage } from "../../../views/aspectTrackingPage";
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

    conf.express.get("/analysis/aspects", ...conf.handlers, async (req, res) => {
        try {
            const data = conf.analysisTracking.report();

            const allAspectTimings = _.flatten(data.analyses
                .map(a => _.flatten(a.repos
                    .filter(r => r.progress === "Stopped")
                    .map(r => r.aspects))));
            const timingsByAspect = _.groupBy(allAspectTimings, a => a.aspectName);

            const summarized = Object.values(timingsByAspect).map(timings => {
                return {
                    aspectName: timings[0].aspectName,
                    runs: timings.length,
                    totalFingerprints: timings.map(t => t.fingerprintsFound).reduce((a, b) => a + b, 0),
                    failures: timings.filter(f => !!f.error).length,
                    minMillis: Math.min(...timings.map(t => t.millisTaken)),
                    maxMillis: Math.max(...timings.map(t => t.millisTaken)),
                    totalTimeTaken: timings.map(t => t.millisTaken).reduce((a, b) => a + b, 0),
                };
            });

            res.send(renderStaticReactNode(
                AspectTrackingPage({ aspectPerformances: summarized }), `Performance of Aspects during Analysis`,
                conf.instanceMetadata));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send("failure");
        }
    });
}
