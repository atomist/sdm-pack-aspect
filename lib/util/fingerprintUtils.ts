import * as _ from "lodash";
import { FP } from "@atomist/sdm-pack-fingerprint";

/**
 * Distinct non-root paths found in this fingerprints
 * @param {FP[]} fingerprints
 * @return {string[]}
 */
export function distinctNonRootPaths(fingerprints: FP[]): string[] {
    return _.uniq(fingerprints
        .map(fp => fp.path)
        .filter(p => !["", ".", undefined].includes(p)),
    );
}
