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

import { BuildListener, BuildListenerInvocation, BuildStatus, } from "@atomist/sdm";
import { DeliveryAspect, FingerprintPublisher } from "./DeliveryAspect";
import { Build } from "@atomist/sdm-pack-build";
import { Omit } from "../../../lib/util/omit";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { logger } from "@atomist/automation-client";
import { Error } from "tslint/lib/error";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";

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
    build?: Build,
    publisher: FingerprintPublisher,
    fingerprintFinder: FindFingerprintsInBuild,
}): BuildAspect<DATA> {
    // TODO default publisher
    return {
        ...opts,
        extract: async () => [],
        register: (sdm, goals) => {
            if (!goals.build) {
                throw new Error("No build goal supplied. Cannot register a build aspect");
            }
            logger.info("Registering build aspect %s", opts.name);
            return goals.build.withListener(buildListener(opts.fingerprintFinder, opts.publisher));
        },
        stats: {
            basicStatsPath: "millis",
            defaultStatStatus: {
                entropy: false,
            }
        }
    };
}

export const BuildTimeType = "build-time";

export function buildTimeAspect(opts: Omit<Aspect, "name" | "displayName" | "extract" | "consolidate"> & {
    build?: Build,
    publisher: FingerprintPublisher,
}): BuildAspect<BuildTimeData> {
    return buildOutcomeAspect({
        ...opts,
        name: "build-time",
        displayName: "Build time",
        fingerprintFinder: async bi => {
            // TODO fix me
            const millis = -1;// bi.build.timestamp - bi.build.startedAt;
            const data = {millis };
            return {
                name: BuildTimeType,
                type: BuildTimeType,
                data,
                sha: sha256(JSON.stringify(data)),
            };
        },
    });
}

function buildListener(fingerprintFinder: FindFingerprintsInBuild, publisher: FingerprintPublisher): BuildListener {
    return async bi => {
        if (buildCompletions.includes(bi.build.status)) {
            const fps = await fingerprintFinder(bi);
            return publisher(bi, toArray(fps));
        }
        return false;
    };
}