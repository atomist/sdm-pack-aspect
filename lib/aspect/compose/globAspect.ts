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

export interface GlobAspectData<D = {}> {
    kind: "glob";
    glob: string;
    matches: Array<GlobMatch & D>;
}

export function isGlobMatchFingerprint(fp: FP): fp is FP<GlobAspectData> {
    const maybe = fp.data as GlobAspectData;
    return !!maybe && maybe.kind === "glob" && !!maybe.glob && maybe.matches !== undefined;
}

export interface Validated {
    /** Test this for a match */
    contentTest?: (content: string, path: string) => boolean;
}

export interface Extracted<D> {
    /** Extract the data object */
    extract: (content: string, path: string) => Promise<D>;
}

export type GlobAspectOptions<D> = AspectMetadata &
    {
        glob: string,
    } & (Validated | Extracted<D>);

function isExtracted(gao: GlobAspectOptions<any>): gao is GlobAspectOptions<any> & Extracted<any> {
    const maybe = gao as Extracted<any>;
    return !!maybe.extract;
}

/**
 * Check for presence of a glob.
 * Always extracts a fingerprint, but may have an empty array of matches.
 * Entropy stat is disabled by default, but callers can override this.
 * Can optionally test file content to exclude matches, or extract additional data for
 * each match with the extract method.
 */
export function globAspect<D = {}>(config: GlobAspectOptions<D>): Aspect<GlobAspectData<D>> {
    if (!config.glob) {
        throw new Error("Glob pattern must be supplied");
    }
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
                    if (isExtracted(config)) {
                        const extracted = await config.extract(content, f.path);
                        return extracted ? {
                            path: f.path,
                            size: content.length,
                            ...extracted,
                        } as any : undefined;
                    } else {
                        const testToUse = config.contentTest || (() => true);
                        return testToUse(content, f.path) ? {
                            path: f.path,
                            size: content.length,
                        } : undefined;
                    }
                }),
            };
            return fingerprintOf({
                type: config.name,
                data,
            });
        },
    };
}
