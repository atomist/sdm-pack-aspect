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

/**
 * Take the path before the literal. Can be empty
 * E.g. "thing/src/main/java/com/myco/Foo.java" could return "thing"
 * @param {string} path
 * @return {string}
 */
export function pathBefore(path: string, literal: string): string {
    const at = path.indexOf(literal);
    return at <= 0 ? undefined : path.slice(0, at);
}