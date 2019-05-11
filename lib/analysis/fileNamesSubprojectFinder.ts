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
    gatherFromFiles,
    GlobOptions,
} from "@atomist/automation-client/lib/project/util/projectUtils";
import * as path from "path";
import {
    SubprojectFinder,
    SubprojectStatus,
} from "./subprojectFinder";

/**
 * Return a SubprojectFinder that infers a directory from filenames that may be
 * anywhere
 */
export function fileNamesSubprojectFinder(...filenames: string[]): SubprojectFinder {
    return async p => {
        const inRoot = await gatherFromFiles(p,
            filenames,
            async f => path.dirname(f.path));
        if (inRoot.length > 0) {
            return {
                status: SubprojectStatus.RootOnly,
            };
        }
        const paths = await gatherFromFiles(p,
            filenames.map(f => "**/" + f),
            async f => path.dirname(f.path));
        if (paths.length > 0) {
            console.log(`The paths within ${p.id.url} are ${paths}`);
            return {
                status: SubprojectStatus.IdentifiedPaths,
                paths,
            };
        }
        return {
            status: SubprojectStatus.Unknown,
        };
    };
}
