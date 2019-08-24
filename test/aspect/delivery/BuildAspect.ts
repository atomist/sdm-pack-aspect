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
import { Build } from "@atomist/sdm-pack-build";
import { Aspect, sha256 } from "@atomist/sdm-pack-fingerprints";
import { bandFor, Default } from "../../../lib/util/bands";
import { Omit } from "../../../lib/util/omit";
import { DeliveryAspect } from "./DeliveryAspect";
import { FindFingerprintsFromGoalExecution, goalExecutionFingerprinter } from "./support/goalListener";

export type BuildAspect<DATA = any> = DeliveryAspect<{ build: Build }, DATA>;

/**
 * Create an SDM BuildListener from BuildAspect
 */
export function buildOutcomeAspect<DATA>(opts: Omit<Aspect, "extract" | "consolidate"> & {
    fingerprintFinder: FindFingerprintsFromGoalExecution,
}): BuildAspect<DATA> {
    return {
        ...opts,
        extract: async () => [],
        register: (sdm, goals, publisher) => {
            if (!goals.build) {
                throw new Error("No build goal supplied. Cannot register a build aspect");
            }
            logger.info("Registering build outcome aspect '%s'", opts.name);
            return goals.build.withExecutionListener(goalExecutionFingerprinter(opts.fingerprintFinder, publisher));
        },
        stats: {
            basicStatsPath: "elapsedMillis",
            defaultStatStatus: {
                entropy: false,
            },
        },
    };
}

export interface BuildTimeData {
    elapsedMillis: number;
}

export const BuildTimeType = "build-time";

/**
 * Capture build time
 */
export function buildTimeAspect(opts: Omit<Aspect, "name" | "displayName" | "extract" | "consolidate"> = {}): BuildAspect<BuildTimeData> {
    return buildOutcomeAspect<BuildTimeData>({
        ...opts,
        name: BuildTimeType,
        displayName: "Build time",
        fingerprintFinder: async gei => {
            const elapsedMillis = Date.now() - gei.goalEvent.ts;
            const data = { elapsedMillis };
            return {
                name: BuildTimeType,
                type: BuildTimeType,
                data,
                sha: sha256(JSON.stringify(data)),
            };
        },
        toDisplayableFingerprintName: () => "Build time",
        toDisplayableFingerprint: fp => {
            const seconds = fp.data.elapsedMillis / 1000;
            return bandFor<"interminable" | "slow" | "ok" | "fast" | "blistering">({
                    blistering: { upTo: 10 },
                    fast: { upTo: 60 },
                    ok: { upTo: 180 },
                    slow: { upTo: 600 },
                    interminable: Default,
                }, seconds,
                { includeNumber: true });
        },
    });
}
