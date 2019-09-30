
import { fileMatches, PathExpressionQueryOptions } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { MatchResult } from "@atomist/automation-client";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprint";

import * as _ from "lodash";
import { AspectMetadata } from "./commonTypes";
import { GlobAspectData, GlobMatch } from "./globAspect";

export interface MatchAspectOptions<D> extends AspectMetadata, Omit<PathExpressionQueryOptions, "globPatterns"> {
    mapper: (m: MatchResult) => D;
    glob: string;
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
            return fingerprintOf({
                type: config.name,
                data,
            });
        },
    };
}
