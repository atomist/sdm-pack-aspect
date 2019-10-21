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

import { logger } from "@atomist/automation-client";
import * as camelcaseKeys from "camelcase-keys";
import { PlantedTree } from "../../../tree/sunburst";
import { validatePlantedTree } from "../../../tree/treeUtils";
import {
    ClientFactory,
    doWithClient,
} from "./pgUtils";
import { TreeQuery } from "./ProjectAnalysisResultStore";

/**
 * Return results for non-matching fingerprints
 */
function nonMatchingRepos(tq: TreeQuery): string {
    const workspaceEquals = tq.workspaceId === "*" ? "<>" : "=";
    return `SELECT  null as id, $4 as name, null as sha, null as data, $1 as type, $4::text as display_name, null as display_value,
            (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.id, repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_snapshots
                   WHERE workspace_id ${workspaceEquals} $1
                   AND repo_snapshots.id not in (select repo_fingerprints.repo_snapshot_id
                    FROM repo_fingerprints WHERE repo_fingerprints.fingerprint_id in
                        (SELECT id from fingerprints where fingerprints.feature_name = $2
                            AND fingerprints.name ${tq.byName ? "=" : "<>"} $3))
                ) repo
         )
         children`;
}

function fingerprintsToReposQuery(tq: TreeQuery): string {
    const workspaceEquals = tq.workspaceId === "*" ? "<>" : "=";
    // We always select by aspect (aka feature_name, aka type), and sometimes also by fingerprint name.
    const sql = `
SELECT row_to_json(fingerprint_groups) FROM (
    SELECT json_agg(fp) as children FROM (
       SELECT
         fingerprints.id as id, fingerprints.name as name, fingerprints.sha as sha,
            fingerprints.data as data, fingerprints.feature_name as type,
            fingerprints.display_name, fingerprints.display_value,
         (
             SELECT json_agg(row_to_json(repo)) FROM (
                  SELECT
                    repo_snapshots.id, repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, repo_snapshots.provider_id, 1 as size, repo_fingerprints.path
                  FROM repo_fingerprints, repo_snapshots
                   WHERE repo_fingerprints.fingerprint_id = fingerprints.id
                    AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                    AND repo_fingerprints.workspace_id ${workspaceEquals} $1
                    AND repo_snapshots.workspace_id ${workspaceEquals} $1
                ) repo
         ) as children FROM fingerprints
         WHERE fingerprints.feature_name = $2 
         AND fingerprints.name ${tq.byName ? "=" : "<>"} $3
         AND fingerprints.workspace_id ${workspaceEquals} $1
         ${tq.otherLabel ? ("UNION ALL " + nonMatchingRepos(tq)) : ""}
) fp WHERE children is not NULL) as fingerprint_groups
`;
    logger.debug("Running fingerprintsToRepos SQL\n%s", sql);
    return sql;
}

/**
 * Tree where children is one of a range of values, leaves individual repos with one of those values
 */
export async function fingerprintsToReposTreeQuery(tq: TreeQuery, clientFactory: ClientFactory): Promise<PlantedTree> {
    const sql = fingerprintsToReposQuery(tq);
    const children = await doWithClient(sql, clientFactory, async client => {
        const bindParams = [tq.workspaceId, tq.aspectName, tq.rootName];
        if (tq.otherLabel) {
            bindParams.push(tq.otherLabel);
        }
        const results = await client.query(sql, bindParams);
        const data = results.rows[0];
        return data.row_to_json.children;
    }, e => e);
    if (isError(children)) {
        throw children;
    }
    const result = {
        tree: {
            name: tq.rootName,
            children,
        },
        circles: [
            { meaning: tq.byName ? "fingerprint name" : "aspect" },
            { meaning: "fingerprint value" },
            { meaning: "repo" },
        ],
    };
    validatePlantedTree(result);
    return camelcaseKeys(result, { deep: true }) as any;
}

function isError(e: any): e is Error {
    return !!e.stack;
}

export async function driftTreeForAllAspects(workspaceId: string,
    percentile: number,
    clientFactory: ClientFactory): Promise<PlantedTree> {
    const sql = driftTreeSql(workspaceId, { repos: false });
    const circles = [
        { meaning: "report" },
        { meaning: "aspect name" },
        { meaning: "fingerprint name" },
    ];
    return doWithClient(sql, clientFactory, async client => {
        const result = await client.query(sql,
            [workspaceId, percentile / 100]);
        const tree: PlantedTree = {
            circles,
            tree: {
                name: "drift",
                children: result.rows.map(r => r.children),
            },
        };
        return tree;
    }, err => {
        return {
            circles,
            tree: { name: "failed drift report", children: [] },
            errors: [{ message: err.message }],
        };
    });
}

export async function driftTreeForSingleAspect(workspaceId: string,
    percentile: number,
    options: { repos?: boolean, type?: string },
    clientFactory: ClientFactory): Promise<PlantedTree> {
    const sql = driftTreeSql(workspaceId, options);
    return doWithClient(sql, clientFactory, async client => {
        const result = await client.query(sql,
            [workspaceId, percentile / 100, options.type]);
        const tree: PlantedTree = {
            circles: !options.repos ? [
                { meaning: "type" },
                { meaning: "fingerprint entropy" },
            ] : [
                    { meaning: "type" },
                    { meaning: "fingerprint entropy" },
                    { meaning: "repos" },
                ],
            tree: {
                name: options.type,
                children: result.rows[0].children.children,
            },
        };
        return tree;
    });
}

function driftTreeSql(workspaceId: string, options: { repos?: boolean, type?: string }): string {
    if (!options.repos) {
        return `SELECT row_to_json(data) as children
    FROM (SELECT f0.type as name, f0.type as type, json_agg(aspects) as children
        FROM (SELECT distinct feature_name as type from fingerprint_analytics) f0, (
            SELECT name, name as fingerprint_name, feature_name as type, variants, count, entropy, variants as size
                FROM fingerprint_analytics f1
                WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
                    AND entropy >=
                        (SELECT percentile_disc($2) within group (order by entropy)
                            FROM fingerprint_analytics
                            WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1)
                ORDER BY entropy DESC, fingerprint_name ASC) as aspects
    WHERE aspects.type = f0.type ${options.type ? `AND aspects.type = $3` : ""}
    GROUP by f0.type) as data`;
    } else {
        // tslint:disable:max-line-length
        return `SELECT row_to_json(data) as children
    FROM (SELECT f0.type as name, f0.type as type, json_agg(aspects) as children
        FROM (SELECT distinct feature_name as type from fingerprint_analytics) f0, (
            SELECT f1.name, f1.name as fingerprint_name, f1.feature_name as type, f1.variants, f1.count, f1.entropy, f1.variants as size, json_agg(repos) as children
                FROM fingerprint_analytics f1, (SELECT distinct _rs1.url, _rs1.owner, _rs1.name, _rs1.url, _f1.feature_name as type, _f1.name as fingerprint_name, 1 as size
                FROM repo_snapshots _rs1, repo_fingerprints _rf1, fingerprints _f1 WHERE _rs1.id = _rf1.repo_snapshot_id AND _rf1.fingerprint_id = _f1.id) as repos
                WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
                    AND entropy >=
                        (SELECT percentile_disc($2) within group (order by entropy)
                            FROM fingerprint_analytics
                            WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1)
                    AND repos.type = f1.feature_name AND repos.fingerprint_name = f1.name
                GROUP BY f1.name, f1.feature_name, f1.variants, f1.count, f1.entropy
                ORDER BY entropy DESC, fingerprint_name ASC) as aspects
    WHERE aspects.type = f0.type ${options.type ? `AND aspects.type = $3` : ""}
    GROUP by f0.type) as data`;
        // tslint:enable:max-line-length
    }
}
