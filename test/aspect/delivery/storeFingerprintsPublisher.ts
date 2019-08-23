import { PublishFingerprints } from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResultStore } from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";

/**
 * "Publish" fingerprints to local store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function storeFingerprints(store: ProjectAnalysisResultStore): PublishFingerprints {
    return async (i, fingerprints) => {
        return store.persist({
            repoRef: i.id,
            // TODO do we need to set this?
            timestamp: undefined,
            workspaceId: i.context.workspaceId,
            analysis: {
                id: i.id,
                fingerprints,
            },
        });
    };
}
