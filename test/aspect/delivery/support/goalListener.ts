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
    Project,
} from "@atomist/automation-client";
import {
    GoalExecutionListener,
    GoalExecutionListenerInvocation,
    PushImpactListenerInvocation,
    SdmGoalState,
} from "@atomist/sdm";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    FP,
    PublishFingerprints,
} from "@atomist/sdm-pack-fingerprints";

export type FindFingerprintsFromGoalExecution = (gei: GoalExecutionListenerInvocation) => Promise<FP[] | FP>;

export function goalExecutionFingerprinter(fingerprintFinder: FindFingerprintsFromGoalExecution, publisher: PublishFingerprints): GoalExecutionListener {
    return async gei => {
        if (gei.goalEvent.state !== SdmGoalState.in_process) {
            const fps = await fingerprintFinder(gei);
            const pili: PushImpactListenerInvocation = {
                ...gei,
                get project(): GitProject { throw new Error("UnsupportedOperation"); },
                get impactedSubProject(): Project { throw new Error("UnsupportedOperation"); },
                get filesChanged(): string[] { throw new Error("UnsupportedOperation"); },
                commit: gei.goalEvent.push.after,
                push: gei.goalEvent.push,
            };
            return publisher(pili, toArray(fps), {});
        }
        return false;
    };
}
