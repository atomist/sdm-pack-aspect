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
import {
    PublishFingerprints,
    PublishFingerprintsFor,
    RepoIdentification,
} from "@atomist/sdm-pack-fingerprint";
import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../../analysis/offline/spider/analytics";
import { ProjectAnalysisResult } from "../../analysis/ProjectAnalysisResult";
import { Analyzed } from "../AspectRegistry";

/**
 * "Publish" fingerprints to local store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function storeFingerprintsFor(store: ProjectAnalysisResultStore): PublishFingerprintsFor {
    return async (ctx, aspects, repoIdentification, fingerprints, previous) => {
        if (fingerprints.length === 0) {
            return true;
        }

        const analysis: Analyzed = {
            id: repoIdentification as any,
            fingerprints,
        };
        const paResult: ProjectAnalysisResult = {
            repoRef: repoIdentification as any,
            workspaceId: ctx.context.workspaceId,
            timestamp: undefined,
            analysis,
        };
        logger.info("Routing %d fingerprints to local database for workspace %s",
            fingerprints.length, ctx.context.workspaceId);
        const found = await store.loadByRepoRef(paResult.analysis.id, false);
        if (!!found) {
            const results = await store.persistAdditionalFingerprints(paResult.analysis);
            logger.info("Persisting additional fingerprint results for %s: %j", paResult.analysis.id.url, results);

            for (const fp of fingerprints) {
                await computeAnalyticsForFingerprintKind(store, ctx.context.workspaceId, fp.type, fp.name);
            }

            return results.failures.length === 0;
        } else {
            const results = await store.persist(paResult);
            logger.info("Persisting snapshot for %s: %j", paResult.analysis.id.url, results);

            for (const fp of fingerprints) {
                await computeAnalyticsForFingerprintKind(store, ctx.context.workspaceId, fp.type, fp.name);
            }
            return results.failed.length === 0;
        }
    };
}

export function storeFingerprints(store: ProjectAnalysisResultStore): PublishFingerprints {
    return (i, aspects, fps, previous) => {
        return storeFingerprintsFor(store)(i, aspects, i.id as RepoIdentification, fps, previous);
    };
}
