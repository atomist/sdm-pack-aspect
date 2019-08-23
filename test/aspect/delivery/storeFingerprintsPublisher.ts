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

/**
 * "Publish" fingerprints to local store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function storeFingerprints(store: ProjectAnalysisResultStore): PublishFingerprints {
    return async (i, fingerprints) => {
        await store.persist({
            repoRef: i.id,
            // TODO do we need to set this?
            timestamp: undefined,
            workspaceId: i.context.workspaceId,
            analysis: {
                id: i.id,
                fingerprints,
            },
        });
        return true;
    };
}
