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
import * as _ from "lodash";
import { SubprojectFinder } from "./subprojectFinder";
import { SubprojectStatus } from "./subprojectFinder";

export const GradleSubprojectFinder: SubprojectFinder = async p => {
    if (await p.hasFile("build.gradle")) {
        return {
            status: SubprojectStatus.RootOnly,
        };
    }
    const paths = await gatherFromFiles(p,
        "**/build.gradle",
        async f => _.dropRight(f.path.split("/"), 1).join("/"));
    if (paths.length > 0) {
        console.log(`The paths within ${p.id.url} are ${paths}`);
        return {
            status: SubprojectStatus.IdentifiedPaths,
            paths,
        }
    }
    return {
        status: SubprojectStatus.Unknown,
    };
};
