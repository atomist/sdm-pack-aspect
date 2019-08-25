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
    GitCommandGitProject,
    LocalProject,
    logger,
    Project,
    GitProject,
} from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/lib/operations/common/GitHubRepoRef";
import { DirectoryManager } from "@atomist/automation-client/lib/spi/clone/DirectoryManager";
import { execPromise } from "@atomist/sdm";
import {
    Cloner,
    GitHubSearchResult,
} from "./GitHubSpider";

/**
 * Cloner implementation using GitCommandGitProject directly
 */
export class GitCommandGitProjectCloner implements Cloner {

    public async clone(sourceData: GitHubSearchResult): Promise<GitProject> {
        const project = await GitCommandGitProject.cloned(
            process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : undefined,
            GitHubRepoRef.from({
                owner: sourceData.owner.login,
                repo: sourceData.name,
                rawApiBase: "https://api.github.com", // for GitHub Enterprise, make this something like github.yourcompany.com/api/v3
            }), {
                alwaysDeep: false,
                noSingleBranch: true,
                depth: 1,
            },
            this.directoryManager);

        if (!project.id.sha) {
            const sha = await execPromise("git", ["rev-parse", "HEAD"], {
                cwd: (project as LocalProject).baseDir,
            });
            project.id.sha = sha.stdout.trim();
            logger.debug(`Set sha to ${project.id.sha}`);
        }
        return project;
    }

    public constructor(private readonly directoryManager: DirectoryManager) { }
}
