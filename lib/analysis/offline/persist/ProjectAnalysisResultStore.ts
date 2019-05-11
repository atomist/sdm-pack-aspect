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

import { RepoId, RepoRef } from "@atomist/automation-client";
import { ProjectAnalysisResult } from "../../ProjectAnalysisResult";

/**
 * Interface for basic persistence operations.
 * Implementations can provide additional querying options,
 * e.g. through SQL.
 */
export interface ProjectAnalysisResultStore {

    /**
     * How many analyses we have stored
     * @return {Promise<number>}
     */
    count(): Promise<number>;

    loadAll(): Promise<ProjectAnalysisResult[]>;

    load(repo: RepoRef): Promise<ProjectAnalysisResult | undefined>;

    persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<number>;

}
