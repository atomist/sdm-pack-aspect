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

import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import {
    Aspect,
    fingerprintOf,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { AspectMetadata } from "./commonTypes";

export interface GlobMatch {
    path: string;
    size: number;
}

export interface GlobAspectData {
    kind: "glob";
    glob: string;
    matches: GlobMatch[];
}

export function isGlobMatchFingerprint(fp: FP): fp is FP<GlobAspectData> {
    const maybe = fp.data as GlobAspectData;
    return !!maybe && maybe.kind === "glob" && !!maybe.glob && maybe.matches !== undefined;
}

/**
 * Check for presence of a glob.
 * Always extracts a fingerprint, but may have an empty array of matches.
 * Entropy stat is disabled by default, but callers can override this
 */
export function globAspect(config: AspectMetadata &
    {
        glob: string,
        contentTest?: (content: string) => boolean,
    }): Aspect<GlobAspectData> {
    if (!config.glob) {
        throw new Error("Glob pattern must be supplied");
    }
    const testToUse = config.contentTest || (() => true);
    return {
        toDisplayableFingerprintName: name => `Glob pattern '${name}'`,
        toDisplayableFingerprint: fp =>
            fp.data.matches.length === 0 ?
                "None" :
                fp.data.matches
                    .map(m => `${m.path}(${m.size})`)
                    .join(),
        stats: {
            defaultStatStatus: {
                entropy: false,
            },
        },
        ...config,
        extract: async p => {
            const data = {
                glob: config.glob,
                kind: "glob" as any,
                matches: await gatherFromFiles(p, config.glob, async f => {
                    const content = await f.getContent();
                    return testToUse(content) ? {
                        path: f.path,
                        size: content.length,
                    } : undefined;
                }),
            };
            return fingerprintOf({
                type: config.name,
                data,
            });
        },
    };
}
