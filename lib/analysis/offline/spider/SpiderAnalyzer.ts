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
    GitProject,
    HandlerContext,
    logger,
    Project,
    ProjectOperationCredentials,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    PreferenceStore,
    PushImpactListenerInvocation,
} from "@atomist/sdm";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    FP,
    VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprint";
import {
    Analyzed,
} from "../../../aspect/AspectRegistry";
import { time } from "../../../util/showTiming";
import {
    Analyzer,
    TimeRecorder,
} from "./Spider";

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
        const pili = fakePushImpactListenerInvocation(p);
        await runExtracts(p, pili, this.aspects, fingerprints, this.timings);
        await runConsolidates(p, pili, this.aspects.filter(aspect => !!aspect.consolidate), fingerprints);

        return {
            id: p.id as RemoteRepoRef,
            fingerprints,
        };
    }

    constructor(private readonly aspects: Aspect[],
                private readonly virtualProjectFinder?: VirtualProjectFinder) {

    }
}

async function runExtracts(p: Project,
                           pili: PushImpactListenerInvocation,
                           aspects: Aspect[],
                           fingerprints: FP[],
                           timings: TimeRecorder): Promise<void> {
    await Promise.all(aspects
        .map(aspect => safeTimedExtract(aspect, p, pili, timings)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function runConsolidates(p: Project,
                               pili: PushImpactListenerInvocation,
                               aspects: Aspect[],
                               fingerprints: FP[]): Promise<void> {
    await Promise.all(aspects
        .map(aspect => safeConsolidate(aspect, fingerprints, p, pili)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function safeTimedExtract(aspect: Aspect,
                                p: Project,
                                pili: PushImpactListenerInvocation,
                                timeRecorder: TimeRecorder): Promise<FP[]> {
    try {
        const timed = await time(async () => aspect.extract(p, pili));
        addTiming(aspect.name, timed.millis, timeRecorder);
        const result = !!timed.result ? toArray(timed.result) : [];
        return result;
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s", aspect.name, err);
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

async function safeConsolidate(aspect: Aspect,
                               existingFingerprints: FP[],
                               p: Project,
                               pili: PushImpactListenerInvocation): Promise<FP[]> {
    try {
        const extracted = await aspect.consolidate(existingFingerprints, p, pili);
        return !!extracted ? toArray(extracted) : [];
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s", aspect.name, err);
        return [];
    }
}

/**
 * Make a fake push for the last commit to this project
 */
function fakePushImpactListenerInvocation(p: Project): PushImpactListenerInvocation {
    return {
        id: p.id as any,
        get context(): HandlerContext {
            throw new Error("Unsupported");
        },
        commit: {
            sha: p.id.sha,
        },
        project: p as GitProject,
        push: {
            repo: undefined,
            branch: "master",
        },
        addressChannels: async () => {
        },
        get filesChanged(): string[] {
            throw new Error("Unsupported");
        },
        get credentials(): ProjectOperationCredentials {
            throw new Error("Unsupported");
        },
        impactedSubProject: p,
        get preferences(): PreferenceStore {
            throw new Error("Unsupported");
        },
        configuration: {},
    };
}
