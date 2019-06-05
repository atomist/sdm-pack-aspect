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
import { SunburstLeaf, SunburstTree } from "../tree/sunburst";

export interface QueryOpts {

    rootName: string;

    excludeNull: boolean;

    /**
     * SQL query. Must return form of value, repo info - Must be sorted by repo
     */
    query: string;
}

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
        const results = await client.query(opts.query);
        // TODO error checking
        return results.rows[0];
    } finally {
        client.end();
    }
}
