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
    GitProject, HandlerContext,
    logger,
    Project, ProjectOperationCredentials,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    FP,
    VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprints";
import {
    Analyzed,
} from "../../../aspect/AspectRegistry";
import { time } from "../../../util/showTiming";
import {
    Analyzer,
    TimeRecorder,
} from "./Spider";
import { PreferenceStore, PushImpactListenerInvocation } from "@atomist/sdm";
import { Error } from "tslint/lib/error";

/**
 * Analyzer implementation that captures timings that are useful during
 * development, but don't need to be captured during regular execution.
 */
export class SpiderAnalyzer implements Analyzer {

    public readonly timings: TimeRecorder = {};

    public async analyze(p: Project): Promise<Analyzed> {
        const fingerprints: FP[] = [];

        if (this.virtualProjectFinder) {
            // Seed the virtual project finder if we have one
            await this.virtualProjectFinder.findVirtualProjectInfo(p);
        }
        await extractRegularAspects(p, this.aspects, fingerprints, this.timings);
        await extractAtomicAspects(p, this.aspects.filter(aspect => !!aspect.consolidate), fingerprints);

        return {
            id: p.id as RemoteRepoRef,
            fingerprints,
        };
    }

    constructor(private readonly aspects: Aspect[],
                private readonly virtualProjectFinder?: VirtualProjectFinder) {

    }
}

async function extractRegularAspects(p: Project,
                                     aspects: Aspect[],
                                     fingerprints: FP[],
                                     timings: TimeRecorder): Promise<void> {
    await Promise.all(aspects
        .map(aspect => extractify(aspect, p, timings)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function extractAtomicAspects(p: Project,
                                    aspects: Aspect[],
                                    fingerprints: FP[]): Promise<void> {
    await Promise.all(aspects
        .map(aspect => extractAtomic(aspect, fingerprints)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function extractify(aspect: Aspect, p: Project, timeRecorder: TimeRecorder): Promise<FP[]> {
    const minimalPushImpactListenerInvocation: PushImpactListenerInvocation = {
        id: p.id as any,
        get context(): HandlerContext { throw new Error("Unsupported"); },
        commit: {
            sha: p.id.sha,
        },
        project: p as GitProject,
        push: {
            repo: undefined,
            branch: "master",
        },
        addressChannels: async () => {},
        get filesChanged(): string[] { throw new Error("Unsupported"); },
        get credentials(): ProjectOperationCredentials { throw new Error("Unsupported"); },
        impactedSubProject: p,
        get preferences(): PreferenceStore { throw new Error("Unsupported"); },
        configuration: {},
    };

    try {
        const timed = await time(async () => aspect.extract(p, minimalPushImpactListenerInvocation));
        addTiming(aspect.name, timed.millis, timeRecorder);
        const result = !!timed.result ? toArray(timed.result) : [];
        return result;
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s",
            aspect.name, err);
        return [];
    }
}

function addTiming(type: string, millis: number, timeRecorder: TimeRecorder): void {
    let found = timeRecorder[type];
    if (!found) {
        found = {
            extractions: 0,
            totalMillis: 0,
        };
        timeRecorder[type] = found;
    }
    found.extractions++;
    found.totalMillis += millis;
}

async function extractAtomic(aspect: Aspect, existingFingerprints: FP[]): Promise<FP[]> {
    try {
        const extracted = await aspect.consolidate(existingFingerprints);
        return !!extracted ? toArray(extracted) : [];
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s",
            aspect.name, err);
        return [];
    }
}
