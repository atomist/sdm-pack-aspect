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

import {
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { distinctNonRootPaths } from "../../util/fingerprintUtils";
import { GlobAspectData, isGlobMatchFingerprint } from "../compose/globAspect";

/**
 * Virtualize all glob fingerprints into virtual projects
 */
export const GlobVirtualizer: Aspect<GlobAspectData> = {
    name: "globSprayer",
    displayName: undefined,
    extract: async () => [],
    consolidate: async fingerprints => {
        const emitted: Array<FP<GlobAspectData>> = [];
        const projectPaths = distinctNonRootPaths(fingerprints);
        const globFingerprints = fingerprints.filter(isGlobMatchFingerprint);
        for (const path of projectPaths) {
            for (const gf of globFingerprints) {
                const data = {
                    ...gf.data,
                    matches: gf.data.matches.filter(m => m.path.startsWith(path)),
                };
                emitted.push({
                    ...gf,
                    data,
                    path,
                });
            }
        }
        return emitted;
    },
};
