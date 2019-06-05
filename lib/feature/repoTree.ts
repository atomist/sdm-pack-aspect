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
