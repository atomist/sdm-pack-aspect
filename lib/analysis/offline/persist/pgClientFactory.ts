import { Configuration } from "@atomist/automation-client";
import * as _ from "lodash";
import { Pool } from "pg";
import { ClientFactory } from "./pgUtils";

const PoolHolder: { pool: Pool } = { pool: undefined };

export function sdmConfigClientFactory(config: Configuration): ClientFactory {
    const usedConfig = {
        database: "org_viz",
        ...(_.get(config, "sdm.postgres") || {}),
    };
    if (!PoolHolder.pool) {
        PoolHolder.pool = new Pool(usedConfig);
    }
    return () => {
        return PoolHolder.pool.connect().catch(e => {
            throw new Error(`${ConnectionErrorHeading}
            Connection parameters: ${JSON.stringify(usedConfig, hidePassword)}
            Error message: ${e.message}`);
        });
    };
}

export const ConnectionErrorHeading = "Could not connect to Postgres.";

function hidePassword(key: any, value: any): any {
    if (key === "password") {
        return "*****";
    }
    return value;
}
