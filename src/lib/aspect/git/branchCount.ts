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
    LocalProject,
    logger,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import {
    fingerprintOf,
} from "@atomist/sdm-pack-fingerprint";
import {
    bandFor,
    Default,
} from "../../util/bands";
import { SizeBands } from "../../util/commonBands";
import { CountAspect } from "../compose/commonTypes";

export const BranchCountType = "branch-count";

/**
 * Aspect that counts branches in git
 */
export const BranchCount: CountAspect = {
    name: BranchCountType,
    displayName: "Branch count",
    baseOnly: true,
    extract: async p => {
        const lp = p as LocalProject;
        const commandResult = await execPromise(
            "git", ["branch", "--list", "-r", "origin/*"],
            {
                cwd: lp.baseDir,
            });
        const count = commandResult.stdout
            .split("\n")
            .filter(l => !l.includes("origin/HEAD")).length - 1;
        const data = { count };
        logger.debug("Branch count for %s is %d", p.id.url, count);
        return fingerprintOf({
            type: BranchCountType,
            data,
        });
    },
    toDisplayableFingerprintName: () => "Branch count",
    toDisplayableFingerprint: fp => {
        return bandFor<SizeBands | "excessive">({
            low: { upTo: 5 },
            medium: { upTo: 12 },
            high: { upTo: 12 },
            excessive: Default,
        }, fp.data.count, { includeNumber: true });
    },
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
        basicStatsPath: "count",
    },
};
