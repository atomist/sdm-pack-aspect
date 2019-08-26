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
    GitProject,
    logger,
    RepoId,
    RepoRef,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as path from "path";
import {
    AnalysisRun,
} from "../common";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Analyzer,
    Spider,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

export class LocalSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: Analyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {

        const go = new AnalysisRun<string>({
            howToFindRepos: () => findRepositoriesUnder(this.localDirectory),
            determineRepoRef: repoRefFromLocalRepo,
            describeFoundRepo: f => f,
            howToClone: (rr, fr) => GitCommandGitProject.fromExistingDirectory(rr, fr) as Promise<GitProject>,
            analyzer,
            persister: opts.persister,

            keepExistingPersisted: opts.keepExistingPersisted,
            projectFilter: criteria.projectTest,
        }, {
                workspaceId: opts.workspaceId,
                description: "local analysis under " + this.localDirectory,
                maxRepos: 1000,
                poolSize: opts.poolSize,
            });

        return go.run();
    }

    constructor(public readonly localDirectory: string) {
    }
}

async function* findRepositoriesUnder(dir: string): AsyncIterable<string> {
    try {
        const stat = await fs.stat(await fs.realpath(dir));
        if (!stat.isDirectory()) {
            // nothing interesting
            return;
        }
    } catch (err) {
        logger.error("Error opening " + dir + ": " + err.message);
        return;
    }

    const dirContents = await fs.readdir(dir);
    if (dirContents.includes(".git")) {
        // this is the repository you are looking for
        yield dir;
        return;
    }

    // recurse over everything inside
    for (const d of dirContents) {
        for await (const dd of findRepositoriesUnder(path.join(dir, d))) {
            yield dd;
        }
    }
}

/**
 * @param repoDir full path to repository
 */
async function repoRefFromLocalRepo(repoDir: string): Promise<RepoRef> {
    const repoId: RepoId = await execPromise("git", ["remote", "get-url", "origin"], { cwd: repoDir })
        .then(execHappened => repoIdFromOriginUrl(execHappened.stdout))
        .catch(() => inventRepoId(repoDir));

    const sha = await execPromise("git", ["rev-parse", "HEAD"], { cwd: repoDir })
        .then(execHappened => execHappened.stdout.trim())
        .catch(() => "unknown");

    return {
        ...repoId,
        sha,
    };
}

function repoIdFromOriginUrl(originUrl: string): RepoId {
    const parse = /\/(?<owner>.+)\/(?<repo>.+)(.git)?$/.exec(originUrl);

    if (!parse) {
        throw new Error("Can't identify owner and repo in url: " + originUrl);
    }

    return {
        repo: parse.groups.repo,
        owner: parse.groups.owner,
        url: originUrl,
    };
}

function inventRepoId(repoDir: string): RepoId {
    const { base, dir } = path.parse(repoDir);
    const repo = base;
    const owner = path.parse(dir).base || "pretendOwner";

    return {
        repo,
        owner,
        url: "file://" + repoDir,
    };
}
