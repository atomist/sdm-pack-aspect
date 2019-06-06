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
import {
    SunburstLeaf,
    SunburstTree,
} from "../tree/sunburst";

export interface QueryOpts {

    rootName: string;

    //excludeNull: boolean;

    /**
     * SQL query. Must return form of value, repo info - Must be sorted by repo
     */
    query: string;
}

// Returns children
export const fingerprintsChildrenQuery = `
SELECT row_to_json(fingerprint_groups) FROM (SELECT json_agg(fp) children
FROM (
       SELECT
         fingerprints.name as n, fingerprints.sha as sha, fingerprints.data as name,
         (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                  WHERE repo_fingerprints.sha = fingerprints.sha AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                ) repo
         ) children
       FROM fingerprints WHERE fingerprints.name = $1
) fp) as fingerprint_groups
`;

/**
 * Tree where children is one of a range of values, leaves individual repos with one of those values
 * @param {QueryOpts} opts
 * @return {Promise<SunburstTree>}
 */
export async function repoTree(opts: QueryOpts): Promise<SunburstTree> {
    const client = new Client({
        database: "org_viz",
    });
    client.connect();
    try {
        console.log(opts.query);
        const results = await client.query(opts.query, [opts.rootName]);
        // TODO error checking
        const data = results.rows[0];
        console.log("RAW: " + JSON.stringify(data));
        return {
            name: opts.rootName,
            children: data.row_to_json.children,
        }
    } finally {
        client.end();
    }
}
