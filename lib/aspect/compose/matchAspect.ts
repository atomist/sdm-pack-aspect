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

import { MatchResult } from "@atomist/automation-client";
import { fileMatches, PathExpressionQueryOptions } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprint";

import * as _ from "lodash";
import { Omit } from "../../util/omit";
import { GlobAspectData, GlobAspectMetadata, GlobMatch } from "./globAspect";

export interface MatchAspectOptions<D> extends GlobAspectMetadata, Omit<PathExpressionQueryOptions, "globPatterns"> {
    mapper: (m: MatchResult) => D;
}

/**
 * Take a glob pattern and parser
 * @param {MatchAspectOptions<D>} config
 * @return {Aspect<GlobAspectData<D>>}
 */
export function matchAspect<D = {}>(config: MatchAspectOptions<D>): Aspect<GlobAspectData<D>> {
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
            const fms = _.flatten((await fileMatches(p, { ...config, globPatterns: config.glob }))
                .map(fileHit => fileHit.matches.map(match => ({ file: fileHit.file, match }))));
            const matches: Array<D & GlobMatch> = fms.map(fm => {
                const d = config.mapper(fm.match);
                if (!d) {
                    return undefined;
                }
                return {
                    ...d,
                    kind: "glob",
                    glob: config.glob,
                    path: fm.file.path,
                    size: -1,
                };
            }).filter(x => !!x);
            const data = {
                glob: config.glob,
                kind: "globMatch" as any,
                matches,
            };
            if (!config.alwaysEmit && data.matches.length === 0) {
                return [];
            }
            return fingerprintOf({
                type: config.name,
                data,
            });
        },
    };
}
