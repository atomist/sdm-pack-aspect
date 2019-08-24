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
import { PublishFingerprints } from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResultStore } from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../../../lib/analysis/offline/spider/analytics";
import { ProjectAnalysisResult } from "../../../lib/analysis/ProjectAnalysisResult";
import { Analyzed } from "../../../lib/aspect/AspectRegistry";

/**
 * "Publish" fingerprints to local store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function storeFingerprints(store: ProjectAnalysisResultStore): PublishFingerprints {
    return async (i, fingerprints) => {
        if (fingerprints.length === 0) {
            return true;
        }

        const analysis: Analyzed = {
            id: i.id,
            fingerprints,
        };
        const paResult: ProjectAnalysisResult = {
            repoRef: i.id,
            workspaceId: i.context.workspaceId,
            timestamp: undefined,
            analysis,
        };
        logger.info("Routing %d fingerprints to local database for workspace %s",
            fingerprints.length, i.context.workspaceId);
        const results = await store.persist(paResult);
        logger.info("Persistence results: %j", results);

        for (const fp of fingerprints) {
            await computeAnalyticsForFingerprintKind(store, i.context.workspaceId, fp.type, fp.name);
        }

        return results.failed.length === 0;
    };
}
