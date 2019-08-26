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
    logger,
    Project,
    RepoId,
} from "@atomist/automation-client";
import { Analyzed } from "../../../aspect/AspectRegistry";
import {
    PersistResult,
    ProjectAnalysisResultStore,
} from "../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../SpideredRepo";
import { ScmSearchCriteria } from "./ScmSearchCriteria";
import {
    Analyzer,
    ProjectAnalysisResultFilter,
    SpiderOptions,
} from "./Spider";

export async function existingRecordShouldBeKept(
    opts: {
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
    },
    repoId: RepoId): Promise<boolean> {
    const found = await opts.persister.loadByRepoRef(repoId, true);
    if (!found || !found.analysis) {
        return false;
    }
    return opts.keepExistingPersisted(found);
}
