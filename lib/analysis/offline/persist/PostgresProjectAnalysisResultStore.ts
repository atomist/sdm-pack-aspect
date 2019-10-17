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
    GitHubRepoRef,
    logger,
    RemoteRepoRef,
    RepoRef,
} from "@atomist/automation-client";
import {
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { toName } from "@atomist/sdm-pack-fingerprint/lib/adhoc/preferences";
import * as camelcaseKeys from "camelcase-keys";
import * as _ from "lodash";
import {
    Client,
    ClientBase,
} from "pg";
import { AnalyzedWorkspace } from "../../../aspect/AspectRegistry";
import {
    PlantedTree,
    TagUsage,
} from "../../../tree/sunburst";
import {
    BandCasing,
    bandFor,
} from "../../../util/bands";
import { EntropySizeBands } from "../../../util/commonBands";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../ProjectAnalysisResult";
import { CohortAnalysis } from "../spider/analytics";
import { SpideredRepo } from "../SpideredRepo";
import {
    ClientFactory,
    doWithClient,
} from "./pgUtils";
import {
    combinePersistResults,
    emptyPersistResult,
    FingerprintInsertionResult,
    FingerprintKind,
    FingerprintUsage,
    PersistResult,
    ProjectAnalysisResultStore,
    TreeQuery,
} from "./ProjectAnalysisResultStore";
import {
    driftTreeForAllAspects,
    driftTreeForSingleAspect,
    fingerprintsToReposTreeQuery,
} from "./repoTree";
// tslint:disable:max-file-line-count

export class PostgresProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    public fingerprintsToReposTree(treeQuery: TreeQuery): Promise<PlantedTree> {
        return fingerprintsToReposTreeQuery(treeQuery, this.clientFactory);
    }

    public aspectDriftTree(workspaceId: string,
                           percentile: number,
                           options?: { repos?: boolean, type?: string }): Promise<PlantedTree> {
        return !!options && !!options.type ?
            driftTreeForSingleAspect(workspaceId, percentile, options, this.clientFactory) :
            driftTreeForAllAspects(workspaceId, percentile, this.clientFactory);
    }

    public distinctRepoCount(workspaceId: string): Promise<number> {
        const sql = `SELECT COUNT(1) FROM (SELECT DISTINCT url
FROM repo_snapshots
WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1) as repos`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql,
                [workspaceId]);
            return +result.rows[0].count;
        });
    }

    public virtualProjectCount(workspaceId: string): Promise<number> {
        const sql = `SELECT COUNT(1) FROM (SELECT DISTINCT repo_snapshot_id, path
FROM repo_snapshots, repo_fingerprints
WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
  AND repo_fingerprints.repo_snapshot_id = repo_snapshots.id) as virtual_repos`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql,
                [workspaceId]);
            return +result.rows[0].count;
        });
    }

    public latestTimestamp(workspaceId: string): Promise<Date> {
        const sql = `SELECT timestamp FROM repo_snapshots WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
        ORDER BY timestamp DESC LIMIT 1`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql,
                [workspaceId]);
            return result.rows[0].timestamp;
        });
    }

    public loadInWorkspace(workspaceId: string, deep: boolean): Promise<ProjectAnalysisResult[]> {
        return this.loadInWorkspaceInternal(workspaceId || "*", deep);
    }

    /**
     * Load repo
     * @param {string} workspaceId workspace id
     * @param {boolean} deep whether to load fingerprints also
     * @param {string} additionalWhereClause does not use aliases, but original table names
     * @param {any[]} additionalParameters additional parameters required by additional where clause
     * @return {Promise<ProjectAnalysisResult[]>}
     */
    private async loadInWorkspaceInternal(workspaceId: string,
                                          deep: boolean,
                                          additionalWhereClause: string = "true",
                                          additionalParameters: any[] = []): Promise<ProjectAnalysisResult[]> {
        const reposOnly = `SELECT id, owner, name, url, commit_sha, timestamp, workspace_id
FROM repo_snapshots
WHERE workspace_id ${workspaceId !== "*" ? "=" : "<>"} $1
AND ${additionalWhereClause}`;
        const reposAndFingerprints = `SELECT repo_snapshots.id,
        repo_snapshots.owner,
        repo_snapshots.name,
        repo_snapshots.url,
        repo_snapshots.commit_sha,
        repo_snapshots.timestamp,
        repo_snapshots.workspace_id,
        json_agg(json_build_object('path', path, 'id', fingerprint_id)) as fingerprint_refs
FROM repo_snapshots
    LEFT JOIN repo_fingerprints ON repo_snapshots.id = repo_fingerprints.repo_snapshot_id
WHERE workspace_id ${workspaceId !== "*" ? "=" : "<>"} $1
AND ${additionalWhereClause}
GROUP BY repo_snapshots.id`;
        const queryForRepoRows = doWithClient(deep ? reposAndFingerprints : reposOnly,
            this.clientFactory, async client => {
                // Load all fingerprints in workspace so we can look up
                const repoSnapshotRows = await client.query(deep ? reposAndFingerprints : reposOnly,
                    [workspaceId, ...additionalParameters]);
                return repoSnapshotRows.rows.map(whyDoesPostgresPutANewlineOnSomeFields).map(row => {
                    const repoRef = rowToRepoRef(row);
                    return {
                        id: row.id,
                        owner: row.owner,
                        name: row.name,
                        url: row.url,
                        commitSha: row.commit_sha,
                        timestamp: row.timestamp,
                        workspaceId: row.workingDescription,
                        repoRef,
                        fingerprintRefs: row.fingerprint_refs,
                        analysis: undefined,
                    };
                });
            }, []);
        if (deep) {
            // We do this join manually instead of returning JSON because of the extent of the duplication
            // and the resulting memory usage.
            // We parallelize the 2 needed queries to reduce latency
            const getFingerprints = this.fingerprintsInWorkspaceRecord(workspaceId);
            const [repoRows, fingerprints] = await Promise.all([queryForRepoRows, getFingerprints]);
            for (const repo of repoRows) {
                repo.analysis = {
                    id: repo.repoRef,
                    fingerprints: repo.fingerprintRefs.map(fref => {
                        return {
                            ...fingerprints[fref.id],
                            path: fref.path,
                        };
                    }),
                };
            }
            return repoRows;
        }
        return queryForRepoRows;
    }

    public async loadById(id: string, deep: boolean, workspaceId?: string): Promise<ProjectAnalysisResult | undefined> {
        const hits = await this.loadInWorkspaceInternal(workspaceId || "*", deep,
            "repo_snapshots.id = $2", [id]);
        return hits.length === 1 ? hits[0] : undefined;
    }

    public async loadByRepoRef(repo: RepoRef, deep: boolean): Promise<ProjectAnalysisResult | undefined> {
        const hits = await this.loadInWorkspaceInternal("*",
            deep,
            "repo_snapshots.owner = $2 AND repo_snapshots.name = $3 AND repo_snapshots.commit_sha = $4",
            [repo.owner, repo.repo, repo.sha]);
        return hits.length === 1 ? hits[0] : undefined;
    }

    public async persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        return this.persistAnalysisResults(isProjectAnalysisResult(repos) ? [repos] : repos);
    }

    public async distinctFingerprintKinds(workspaceId: string): Promise<FingerprintKind[]> {
        const sql = `SELECT DISTINCT f.name, feature_name as type
  FROM repo_fingerprints rf, repo_snapshots rs, fingerprints f
  WHERE rf.repo_snapshot_id = rs.id AND rf.fingerprint_id = f.id
    AND rs.workspace_id ${workspaceId === "*" ? "<>" : "="} $1`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql, [workspaceId]);
            return result.rows;
        }, []);
    }

    public async distinctRepoFingerprintKinds(workspaceId: string): Promise<Array<{ owner: string, repo: string, fingerprints: FingerprintKind[] }>> {
        const sql = `SELECT DISTINCT rs.owner, rs.name as repo, f.name, feature_name as type
  FROM repo_fingerprints rf, repo_snapshots rs, fingerprints f
  WHERE rf.repo_snapshot_id = rs.id AND rf.fingerprint_id = f.id
    AND rs.workspace_id ${workspaceId === "*" ? "<>" : "="} $1`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql, [workspaceId]);
            return _.map(_.groupBy(result.rows, r => `${r.owner}/${r.repo}`), (v, k) => {
                return {
                    owner: k.split("/")[0],
                    repo: k.split("/")[1],
                    fingerprints: v,
                };
            });
        }, []);
    }

    public tags(workspaceId: string): Promise<TagUsage[]> {
        const sql = `SELECT fp.name as name, fp.data ->> 'description' as description, fp.feature_name as parent, count(fp.name)
  FROM repo_snapshots rs, repo_fingerprints j, fingerprints fp
  WHERE j.repo_snapshot_id = rs.id and j.fingerprint_id = fp.id
    AND rs.workspace_id ${workspaceId === "*" ? "<>" : "="} $1
    AND fp.data ->> 'reason' IS NOT NULL
  GROUP BY fp.name, parent, description`;
        return doWithClient(sql, this.clientFactory, async client => {
            const result = await client.query(sql, [workspaceId]);
            return result.rows;
        }, []);
    }

    public fingerprintUsageForType(workspaceId: string, type?: string): Promise<FingerprintUsage[]> {
        return fingerprintUsageForType(this.clientFactory, workspaceId, type);
    }

    public async loadFingerprintById(id: string): Promise<FP | undefined> {
        const sql = `SELECT id, name, feature_name as type, sha, data FROM fingerprints
WHERE id = $1`;
        return doWithClient(sql, this.clientFactory, async client => {
            const rows = await client.query(sql, [id]);
            return rows.rows.length === 1 ? rows.rows[0] : undefined;
        });
    }

    /**
     * Key is persistent fingerprint id
     */
    private async fingerprintsInWorkspaceRecord(workspaceId: string, type?: string, name?: string): Promise<Record<string, FP & { id: string }>> {
        const fingerprintsArray = await this.fingerprintsInWorkspace(workspaceId, true, type, name);
        const fingerprints: Record<string, FP & { id: string }> = {};
        fingerprintsArray.forEach(fp => fingerprints[fp.id] = fp);
        return fingerprints;
    }

    public async fingerprintsInWorkspace(workspaceId: string, distinct: boolean, type?: string, name?: string): Promise<Array<FP & { id: string }>> {
        return fingerprintsInWorkspace(this.clientFactory, workspaceId, distinct, type, name);
    }

    public async fingerprintsForProject(snapshotId: string): Promise<Array<FP & { timestamp: Date, commitSha: string }>> {
        return fingerprintsForProject(this.clientFactory, snapshotId);
    }

    public async averageFingerprintCount(workspaceId?: string): Promise<number> {
        const sql = `SELECT avg(count) as average_fingerprints from (SELECT repo_snapshots.id, count(feature_name) from repo_snapshots,
(select distinct feature_name, repo_snapshot_id, repo_fingerprints.path
  FROM repo_fingerprints, fingerprints
  WHERE repo_fingerprints.fingerprint_id = fingerprints.id)
AS aspects
WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
AND repo_snapshot_id = repo_snapshots.id
GROUP by repo_snapshots.id) stats;`;
        return doWithClient(sql, this.clientFactory, async client => {
            const rows = await client.query(sql, [workspaceId || "*"]);
            return rows.rows.length === 1 ? rows.rows[0].average_fingerprints : -1;
        }, () => -1);
    }

    public async persistAnalytics(data: Array<{ workspaceId: string, kind: FingerprintKind, cohortAnalysis: CohortAnalysis }>): Promise<boolean> {
        return doWithClient("Persist analytics", this.clientFactory, async client => {
            for (const { kind, workspaceId, cohortAnalysis } of data) {
                const sql = `INSERT INTO fingerprint_analytics (feature_name, name, workspace_id, entropy, variants, count)
        values ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ON CONSTRAINT fingerprint_analytics_pkey DO UPDATE SET entropy = $4, variants = $5, count = $6`;
                await client.query(sql, [kind.type, kind.name, workspaceId,
                cohortAnalysis.entropy, cohortAnalysis.variants, cohortAnalysis.count]);
            }
            return true;
        });
    }

    private async persistAnalysisResults(
        analysisResultIterator: AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        return doWithClient("Persist analysis results", this.clientFactory, async client => {
            const persistResults: PersistResult[] = [];
            for await (const analysisResult of analysisResultIterator) {
                persistResults.push(await this.persistOne(client, analysisResult));
            }
            return persistResults.reduce(combinePersistResults, emptyPersistResult);
        }, emptyPersistResult);
    }

    private async persistOne(client: ClientBase, analysisResult: ProjectAnalysisResult): Promise<PersistResult> {
        const repoRef = analysisResult.repoRef;
        if (!repoRef) {
            return {
                ...emptyPersistResult,
                attemptedCount: 1,
                failed: [{
                    repoUrl: "missing repoRef",
                    whileTryingTo: "build object to persist",
                    message: "No RepoRef",
                }],
            };
        }
        if (!repoRef.url || !repoRef.sha) {
            return {
                ...emptyPersistResult,
                attemptedCount: 1,
                failed: [{
                    repoUrl: "missing url or SHA. Repo is named " + repoRef.repo,
                    whileTryingTo: "build object to persist",
                    message: `Incomplete RepoRef ${JSON.stringify(repoRef)}`,
                }],
            };
        }

        try {
            // Whack any snapshot we already hold for this repository
            await deleteOldSnapshotForRepository(repoRef, client);

            // Use this as unique database id
            const snapshotId = snapshotIdFor(repoRef);
            await this.persistRepoSnapshot(client, snapshotId, analysisResult.workspaceId, repoRef,
                (analysisResult as SpideredRepo).query);
            const fingerprintPersistResults = await this.persistFingerprints(client,
                {
                    fingerprints: analysisResult.analysis.fingerprints,
                    workspaceId: analysisResult.workspaceId, snapshotId,
                });
            return {
                ...emptyPersistResult,
                succeeded: [snapshotId],
                attemptedCount: 1,
                failedFingerprints: fingerprintPersistResults.failures,
            };
        } catch (err) {
            return {
                ...emptyPersistResult,
                attemptedCount: 1,
                failed: [{
                    repoUrl: repoRef.url,
                    whileTryingTo: "persist in DB",
                    message: err.message,
                }],
            };
        }
    }
    private async persistRepoSnapshot(client: ClientBase, snapshotId: string, workspaceId: string, repoRef: RepoRef,
                                      query?: string) {
        const shaToUse = repoRef.sha;
        const repoSnapshotsInsertSql = `INSERT INTO repo_snapshots (id, workspace_id, provider_id, owner, name, url,
            commit_sha, query, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp)`;
        logger.debug("Executing SQL:\n%s", repoSnapshotsInsertSql);
        await client.query(repoSnapshotsInsertSql,
            [snapshotId,
                workspaceId,
                "github",
                repoRef.owner,
                repoRef.repo,
                repoRef.url,
                shaToUse,
                query,
            ]);
    }

    public async persistAdditionalFingerprints(analyzed: AnalyzedWorkspace): Promise<FingerprintInsertionResult> {
        const { fingerprints, workspaceId } = analyzed;
        return doWithClient(`Persist additional fingerprints for project at ${analyzed.id.url}`,
            this.clientFactory,
            async client => {
                const snapshotId = snapshotIdFor(analyzed.id);
                return this.persistFingerprints(client, { fingerprints, workspaceId, snapshotId });
            }, {
            insertedCount: 0,
            failures: analyzed.fingerprints
                .map(failedFingerprint => ({ failedFingerprint, error: undefined })),
        });
    }

    // Persist the fingerprints for this analysis
    private async persistFingerprints(client: ClientBase, params: {
        fingerprints: FP[],
        workspaceId: string,
        snapshotId: string,
    }): Promise<FingerprintInsertionResult> {
        let insertedCount = 0;
        const { workspaceId } = params;
        const failures: Array<{ failedFingerprint: FP; error: Error }> = [];
        for (const fp of params.fingerprints) {
            const aspectName = fp.type || "unknown";
            const fingerprintId = aspectName + "_" + fp.name + "_" + fp.sha;
            //  console.log("Persist fingerprint " + JSON.stringify(fp) + " for id " + id);
            // Create fp record if it doesn't exist
            try {
                await this.ensureFingerprintStored(client, { fingerprint: fp, workspaceId });
                const insertRepoFingerprintSql = `INSERT INTO repo_fingerprints (
                    fingerprint_workspace_id,
                    repo_snapshot_id,
                    fingerprint_id,
                    path)
VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`;
                await client.query(insertRepoFingerprintSql, [params.workspaceId, params.snapshotId, fingerprintId, fp.path || ""]);
                insertedCount++;
            } catch (error) {
                failures.push({ failedFingerprint: fp, error });
            }
        }
        failures.forEach(f => {
            logger.error(`Could not persist fingerprint.
Error: ${f.error.message}
Repo: ${params.snapshotId}
Fingerprint: ${JSON.stringify(f.failedFingerprint, undefined, 2)}`);
        });
        return {
            insertedCount,
            failures,
        };
    }

    /**
     * Persist the given fingerprint if it's not already known
     * @param {FP} fp
     * @param {Client} client
     * @return {Promise<void>}
     */
    private async ensureFingerprintStored(client: ClientBase, params: { fingerprint: FP, workspaceId: string }): Promise<string> {
        const { fingerprint, workspaceId } = params;
        const aspectName = fingerprint.type || "unknown";
        const fingerprintId = aspectName + "_" + fingerprint.name + "_" + fingerprint.sha;
        //  console.log("Persist fingerprint " + JSON.stringify(fp) + " for id " + id);
        // Create fp record if it doesn't exist
        const insertFingerprintSql = `INSERT INTO fingerprints (workspace_id, id, name, feature_name, sha, data, display_name, display_value)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`;
        logger.debug("Persisting fingerprint %j SQL\n%s", fingerprint, insertFingerprintSql);
        await client.query(insertFingerprintSql, [workspaceId, fingerprintId, fingerprint.name, aspectName, fingerprint.sha,
            JSON.stringify(fingerprint.data), fingerprint.displayName, fingerprint.displayValue]);
        return fingerprintId;
    }

    constructor(public readonly clientFactory: ClientFactory) {
    }

}

/**
 * Raw fingerprints in the workspace
 * @return {Promise<FP[]>}
 */
async function fingerprintsInWorkspace(clientFactory: ClientFactory,
                                       workspaceId: string,
                                       distinct: boolean,
                                       type?: string,
                                       name?: string): Promise<Array<FP & { id: string }>> {
    const sql = `SELECT ${distinct ? "DISTINCT" : ""} f.name, f.id, f.feature_name as type, f.sha, f.data
FROM repo_snapshots rs
    RIGHT JOIN repo_fingerprints rf ON rf.repo_snapshot_id = rs.id
    INNER JOIN fingerprints f ON rf.fingerprint_id = f.id
WHERE rs.workspace_id ${workspaceId === "*" ? "<>" : "="} $1
    AND ${type ? "f.feature_name = $2" : "true"} AND ${name ? "f.name = $3" : "true"}`;
    return doWithClient(sql, clientFactory, async client => {
        const params = [workspaceId];
        if (!!type) {
            params.push(type);
        }
        if (!!name) {
            params.push(name);
        }

        const rows = await client.query(sql, params);
        const fps = rows.rows;
        logger.debug("%d fingerprints in workspace '%s'", fps.length, workspaceId);
        return fps;
    }, []);
}

async function fingerprintsForProject(clientFactory: ClientFactory,
                                      snapshotId: string): Promise<Array<FP & { timestamp: Date, commitSha: string }>> {
    const sql = `SELECT f.name as fingerprintName, f.feature_name, f.sha, f.data, rf.path, rs.timestamp, rs.commit_sha
FROM repo_fingerprints rf, repo_snapshots rs, fingerprints f
WHERE rs.id = $1 AND rf.repo_snapshot_id = rs.id AND rf.fingerprint_id = f.id
ORDER BY feature_name, fingerprintName ASC`;
    return doWithClient(sql, clientFactory, async client => {
        const rows = await client.query(sql, [snapshotId]);
        return rows.rows.map(row => {
            return {
                name: row.fingerprintname,
                type: row.feature_name,
                sha: row.sha,
                data: row.data,
                path: row.path,
                timestamp: row.timestamp,
                commitSha: row.commit_sha,
            };
        });
    }, []);
}

async function fingerprintUsageForType(clientFactory: ClientFactory, workspaceId: string, type?: string): Promise<FingerprintUsage[]> {
    const sql = `SELECT distinct fa.name, fa.feature_name as type, fa.variants, fa.count, fa.entropy, fa.compliance, f.display_name
FROM fingerprint_analytics fa, fingerprints f
WHERE fa.workspace_id ${workspaceId === "*" ? "!=" : "="} $1
AND f.name = fa.name AND f.feature_name = fa.feature_name
AND  ${type ? "fa.feature_name = $2" : "true"}
ORDER BY fa.entropy DESC`;
    return doWithClient<FingerprintUsage[]>(sql, clientFactory, async client => {
        const params = [workspaceId];
        if (!!type) {
            params.push(type);
        }
        const rows = await client.query(sql, params);
        const fps = rows.rows.map(r => ({
            name: r.name,
            displayName: r.display_name,
            type: r.type,
            fingerprint: toName(r.type, r.name),
            variants: +r.variants,
            count: +r.count,
            entropy: +r.entropy,
            entropyBand: bandFor(EntropySizeBands, +r.entropy, { casing: BandCasing.Sentence, includeNumber: false }),
            compliance: +r.compliance,
        }));
        return fps.filter(fp => {
            if (!!fp.displayName) {
                return true;
            } else {
                return fps.filter(f => fp.type === f.type && fp.name === f.name).length === 1;
            }
        });
    }, []);
}

/**
 * Delete the data we hold for this repository.
 */
async function deleteOldSnapshotForRepository(repoRef: RepoRef, client: ClientBase): Promise<void> {
    const deleteFingerpintsSql = `DELETE from repo_fingerprints WHERE repo_snapshot_id IN
    (SELECT id from repo_snapshots WHERE url = $1)`;
    await client.query(deleteFingerpintsSql,
        [repoRef.url]);
    await client.query(`DELETE from repo_snapshots WHERE url = $1`,
        [repoRef.url]);
}

function rowToRepoRef(row: { provider_id: string, owner: string, name: string, url: string, sha?: string, commit_sha?: string }): RemoteRepoRef {
    return GitHubRepoRef.from({
        ...row,
        sha: row.commit_sha,
        repo: row.name,
    });
}

function whyDoesPostgresPutANewlineOnSomeFields<T extends { commit_sha?: string, id?: string }>(row: T): T {
    return {
        ...row,
        commit_sha: row.commit_sha ? row.commit_sha.trim() : undefined,
        id: row.id ? row.id.trim() : undefined,
    };
}

function snapshotIdFor(repoRef: RepoRef): string {
    return repoRef.url.replace("/", "") + "_" + repoRef.sha;
}
