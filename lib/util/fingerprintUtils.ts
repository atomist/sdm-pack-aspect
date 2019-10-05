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

import { FP } from "@atomist/sdm-pack-fingerprint";
import * as _ from "lodash";

/**
 * Distinct non-root paths found in this fingerprints
 * @param {FP[]} fingerprints
 * @return {string[]}
 */
export function distinctNonRootPaths(fingerprints: Array<{path?: string}>): string[] {
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
