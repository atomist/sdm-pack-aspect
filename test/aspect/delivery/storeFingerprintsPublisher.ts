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

import { PublishFingerprints } from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResultStore } from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { logger } from "@atomist/automation-client";
import { Analyzed } from "../../../lib/aspect/AspectRegistry";
import { ProjectAnalysisResult } from "../../../lib/analysis/ProjectAnalysisResult";

/**
 * "Publish" fingerprints to local store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function storeFingerprints(store: ProjectAnalysisResultStore): PublishFingerprints {
    return async (i, fingerprints) => {
        const analysis: Analyzed = {
            id: i.id,
            fingerprints,
        };
        const paResult: ProjectAnalysisResult = {
            repoRef: i.id,
            workspaceId: i.context.workspaceId,
            // TODO do we need to set this
            timestamp: undefined,
            analysis,
        };
        logger.info("Routing %d fingerprints to local database for workspace %s",
            fingerprints.length, i.context.workspaceId);
        const results = await store.persist(paResult);
        logger.info("Persistence results: %j", results);
        return results.failed.length === 0;
    };
}
