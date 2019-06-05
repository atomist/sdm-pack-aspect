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

import { Client } from "pg";
import { RepoId } from "@atomist/automation-client";
import { PersistResult, ProjectAnalysisResultStore } from "./ProjectAnalysisResultStore";
import { isProjectAnalysisResult, ProjectAnalysisResult } from "../../ProjectAnalysisResult";

export class PostgresProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    public count(): Promise<number> {
        throw "unimplemented";
    }

    public loadAll(): Promise<ProjectAnalysisResult[]> {
        throw "unimplemented";
    }

    // TODO also check for sha
    public async load(repo: RepoId): Promise<ProjectAnalysisResult> {
        return this.doWithClient(async client => {
            const rows = await client.query(`SELECT (
                owner, name, url, commit_sha, analysis, timestamp) from repo_snapshots
                WHERE url = $1`, [repo.url]);
            return rows.length === 1 ? {
                analysis: rows[0].analysis,
                timestamp: rows[0].timestamp,
            } : undefined;
        });
    }

    public async persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        const persisted = await this.persistAnalysisResults(isProjectAnalysisResult(repos) ? [repos] : repos);
        return {
            // TODO fix this
            succeeded: [],
            failed: [],
            attemptedCount: persisted,
        };
    }

    private async persistAnalysisResults(results: AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<number> {
        return this.doWithClient(async client => {
            let persisted = 0;
            for await (const result of results) {
                const repoRef = result.analysis.id;
                if (!repoRef.url) {
                    console.log("Ignoring repo w/o url: " + repoRef.repo);
                    continue;
                }
                await client.query(`
            INSERT INTO repo_snapshots (workspace_id, provider_id, owner, name, url, commit_sha, analysis, timestamp)
VALUES ('local', $3, $1, $2, $3, $4, $5, current_timestamp)`,
                    [repoRef.owner, repoRef.repo, repoRef.url,
                        !!result.analysis.gitStatus ? result.analysis.gitStatus.sha : undefined,
                        result.analysis,
                    ]);
                ++persisted;
            }
            return persisted;
        });
    }

    private async doWithClient<R>(what: (c: Client) => Promise<R>): Promise<R> {
        const client = new Client({
            database: this.database,
        });
        let result: R;
        await client.connect();
        try {
            result = await what(client);
        } finally {
            client.end();
        }
        return result;
    }

    constructor(public readonly database: string = "org_viz") {

    }

}
