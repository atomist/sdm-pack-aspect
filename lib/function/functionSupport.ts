import { guid } from "@atomist/automation-client";
import { metadata } from "@atomist/sdm";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

export function functionSupport(options: { aspect: Aspect }) {
    return {
        ...metadata(),
        configure: sdm => {
            sdm.configuration.apiKey = guid();
            sdm.configuration.workspaceIds = [guid()];
            sdm.configuration.aspect = options.aspect;
        },
    };
}
