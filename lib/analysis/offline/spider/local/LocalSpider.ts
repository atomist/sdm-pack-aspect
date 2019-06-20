import { ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import { Spider, SpiderOptions, SpiderResult } from "../Spider";

import { NodeFsLocalProject, RepoId } from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as path from "path";
import { keepExistingPersisted } from "../common";

export class LocalSpider implements Spider {
    constructor(public readonly localDirectory: string) { }

    public async spider(criteria: ScmSearchCriteria,
        analyzer: ProjectAnalyzer,
        opts: SpiderOptions): Promise<SpiderResult> {

        const repoIterator = findRepositoriesUnder(this.localDirectory);

        const results: SpiderResult[] = [];

        for await (const repoDir of repoIterator) {
            console.log(repoDir);
            results.push(await spiderOneLocalRepo(opts, repoDir));
        }

        return results.reduce(combineSpiderResults, emptySpiderResult);
    }
}

function combineSpiderResults(r1: SpiderResult, r2: SpiderResult): SpiderResult {
    return {
        repositoriesDetected: r1.repositoriesDetected + r2.repositoriesDetected,
        projectsDetected: r1.projectsDetected + r2.projectsDetected,
        failed:
            [...r1.failed, ...r2.failed],
        keptExisting: [...r1.keptExisting, ...r2.keptExisting],
        persistedAnalyses: [...r1.persistedAnalyses, ...r2.persistedAnalyses],
    };
}

const emptySpiderResult = {
    repositoriesDetected: 0,
    projectsDetected: 0,
    failed:
        [],
    keptExisting: [],
    persistedAnalyses: [],
};

const oneSpiderResult = {
    ...emptySpiderResult,
    repositoriesDetected: 1,
    projectsDetected: 1,
};

async function spiderOneLocalRepo(opts: SpiderOptions, repoDir: string): Promise<SpiderResult> {
    const localRepoId = await repoIdFromLocalRepo(repoDir);

    if (await keepExistingPersisted(opts, localRepoId)) {
        return {
            ...oneSpiderResult,
            keptExisting: [localRepoId.url],
        };
    }

    const project = NodeFsLocalProject.fromExistingDirectory(localRepoId, repoDir);

    return {
        ...oneSpiderResult,
        failed: [{
            repoUrl: localRepoId.url,
            whileTryingTo: "finish implementing",
            message: "keep working Jess",
        }],
    };
}

async function* findRepositoriesUnder(dir: string): AsyncIterable<string> {
    try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
            // nothing interesting
            return;
        }
    } catch (err) {
        throw new Error("Error opening " + dir + ": " + err.message);
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
function repoIdFromLocalRepo(repoDir: string): Promise<RepoId> {
    return execPromise("git", ["remote", "get-url", "origin"], { cwd: repoDir })
        .then(execHappened => repoIdFromOriginUrl(execHappened.stdout))
        .catch(oops => inventRepoId(repoDir));
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
