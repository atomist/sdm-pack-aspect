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
