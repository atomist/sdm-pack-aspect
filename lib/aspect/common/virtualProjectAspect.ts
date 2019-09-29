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

import { Project, ProjectFile } from "@atomist/automation-client";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprint";

import * as _ from "lodash";

import { isFile } from "@atomist/automation-client/lib/project/File";
import * as pathlib from "path";

export interface VirtualProjectData {

    readonly reason: string;

    /**
     * Virtual project paths within this project
     */
    readonly path: string;
}

export interface VirtualProjectFinding {

    readonly reason: string;

    /**
     * Virtual project paths within this project
     */
    readonly paths: string[];
}

export const VirtualProjectType = "virtual-projects";

// TODO move to aspect pack
export function virtualProjectAspect(
    ...finders: Array<(p: Project) => Promise<VirtualProjectFinding>>): Aspect<VirtualProjectData> {
    return {
        name: VirtualProjectType,
        displayName: undefined,
        extract: async p => {
            const findings = await Promise.all(finders.map(finder => finder(p)));
            return _.flatten(findings.map(finding =>
                finding.paths.map(path => fingerprintOf({
                        type: VirtualProjectType,
                        data: { reason: finding.reason, path },
                        path,
                    }),
                )));
        },
    };
}

/**
 * Convenient function to extract directory name from the file
 * @param {File} f
 * @return {string}
 */
export function dirName(f: ProjectFile | string): string {
    return pathlib.dirname(isFile(f) ? f.path : f);
}
