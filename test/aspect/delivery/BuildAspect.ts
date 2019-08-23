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
import {
    BuildListener,
    BuildListenerInvocation,
    BuildStatus,
    PushImpactListenerInvocation,
    PushListenerInvocation,
} from "@atomist/sdm";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { Build } from "@atomist/sdm-pack-build";
import { Aspect, FP, PublishFingerprints, sha256 } from "@atomist/sdm-pack-fingerprints";
import { Error } from "tslint/lib/error";
import { Omit } from "../../../lib/util/omit";
import {
    DeliveryAspect,
} from "./DeliveryAspect";

export type BuildAspect<DATA = any> = DeliveryAspect<{ build: Build }, DATA>;

const buildCompletions = [BuildStatus.broken, BuildStatus.error, BuildStatus.failed, BuildStatus.passed];

export type FindFingerprintsInBuild = (completedBuild: BuildListenerInvocation) => Promise<FP[] | FP>;

export interface BuildTimeData {
    millis: number;
}

/**
 * Create an SDM BuildListener from BuildAspect
 */
export function buildOutcomeAspect<DATA>(opts: Omit<Aspect, "extract" | "consolidate"> & {
    fingerprintFinder: FindFingerprintsInBuild,
}): BuildAspect<DATA> {
    return {
        ...opts,
        extract: async () => [],
        register: (sdm, goals, publisher) => {
            if (!goals.build) {
                throw new Error("No build goal supplied. Cannot register a build aspect");
            }
            logger.info("Registering build outcome aspect '%s'", opts.name);
            return goals.build.withListener(buildListener(opts.fingerprintFinder, publisher));
        },
        stats: {
            basicStatsPath: "elapsedMillis",
            defaultStatStatus: {
                entropy: false,
            },
        },
    };
}

export const BuildTimeType = "build-time";

/**
 * Log build time
 * @param {Omit<Aspect, "name" | "displayName" | "extract" | "consolidate">} opts
 * @return {BuildAspect<BuildTimeData>}
 */
export function buildTimeAspect(opts: Omit<Aspect, "name" | "displayName" | "extract" | "consolidate"> = {}): BuildAspect<BuildTimeData> {
    return buildOutcomeAspect({
        ...opts,
        name: "build-time",
        displayName: "Build time",
        fingerprintFinder: async bi => {
            try {
                const elapsedMillis = parseInt(bi.build.timestamp, 10) - parseInt(bi.build.startedAt, 10);
                const data = { millis: elapsedMillis };
                return {
                    name: BuildTimeType,
                    type: BuildTimeType,
                    data,
                    sha: sha256(JSON.stringify(data)),
                };
            } catch (err) {
                logger.warn("Couldn't parse build timestamps %s and %s", bi.build.timestamp, bi.build.startedAt);
                return undefined;
            }
        },
    });
}

function buildListener(fingerprintFinder: FindFingerprintsInBuild, publisher: PublishFingerprints): BuildListener {
    return async bi => {
        if (buildCompletions.includes(bi.build.status)) {
            const fps = await fingerprintFinder(bi);
            const pili: PushImpactListenerInvocation = {
                ...bi,
                // TODO replace by throwing error
                project: undefined,
                ...bi.build,
                impactedSubProject: undefined,
                filesChanged: undefined,
                commit: bi.build.commit,
                push: bi.build.push,
            };
            return publisher(pili, toArray(fps), {});
        }
        return false;
    };
}
