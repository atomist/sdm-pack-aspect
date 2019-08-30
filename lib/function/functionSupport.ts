import { guid } from "@atomist/automation-client";
import {
    ExtensionPack,
    metadata,
} from "@atomist/sdm";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

export function functionSupport(options: { aspect: Aspect }): ExtensionPack {
    return {
        ...metadata(),
        configure: sdm => {
            sdm.configuration.apiKey = guid();
            sdm.configuration.workspaceIds = [guid()];
            sdm.configuration.aspect = options.aspect;
        },
    };
}
