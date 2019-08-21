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

import { Project } from "@atomist/automation-client";
import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import * as path from "path";

interface TypeScriptSourceDirectoriesFingerprintData { directories: string[]; }

const TypeScriptSourceDirectoriesAspectName = "TypeScriptSourceDirectories";

const TypeScriptSourceCountByDirectoryFingerprintName = "TypeScriptSourceCountByDirectory";

function toTypeScriptSourceDirectoriesFingerprint(data: TypeScriptSourceDirectoriesFingerprintData):
    FP<TypeScriptSourceDirectoriesFingerprintData> {
    return {
        name: TypeScriptSourceCountByDirectoryFingerprintName,
        type: TypeScriptSourceDirectoriesAspectName,
        data,
        sha: sha256(JSON.stringify(data)),
    };
}

export const extractTypeScriptSourceDirectories: // ExtractFingerprint
    (p: Project) => Promise<Array<FP<TypeScriptSourceDirectoriesFingerprintData>>> = async p => {
        const allDirs = await gatherFromFiles(p, "**/*.ts", async f => path.dirname(f.path).split(path.sep)[0]);
        if (!allDirs || allDirs.length === 0) {
            return [];
        }
        const filesByPath = _.groupBy(allDirs);
        const counts = Object.keys(filesByPath).map(dir => {
            return { name: dir, count: filesByPath[dir].length };
        }).sort(byCountAndThenName);
        return [toTypeScriptSourceDirectoriesFingerprint({ directories: counts.map(c => c.name) })];
    };

function byCountAndThenName<T extends { name: string, count: number }>(a: T, b: T): number {
    if (a.count > b.count) { return -1; }
    if (b.count > a.count) { return 1; }

    if (a.name > b.name) { return 1; }
    if (b.name > a.name) { return -1; }
    return 0;
}

export const TypeScriptSourceDirectoriesAspect: Aspect<TypeScriptSourceDirectoriesFingerprintData> = {
    displayName: "TS Source Directories",
    name: TypeScriptSourceDirectoriesAspectName,
    extract: extractTypeScriptSourceDirectories,
    toDisplayableFingerprintName: () => "TypeScript Source Directories",
    toDisplayableFingerprint: fp => fp.data.directories.join(", "),
};
