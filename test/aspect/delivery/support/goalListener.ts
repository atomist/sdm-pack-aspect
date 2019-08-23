import {
    GoalExecutionListener,
    GoalExecutionListenerInvocation,
    PushImpactListenerInvocation,
    SdmGoalState
} from "@atomist/sdm";
import { GitProject, Project } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { FP, PublishFingerprints } from "@atomist/sdm-pack-fingerprints";

export type FindFingerprintsFromGoalExecution = (gei: GoalExecutionListenerInvocation) => Promise<FP[] | FP>;

export function goalExecutionFingerprinter(fingerprintFinder: FindFingerprintsFromGoalExecution, publisher: PublishFingerprints): GoalExecutionListener {
    return async gei => {
        if (gei.goalEvent.state !== SdmGoalState.in_process) {
            const fps = await fingerprintFinder(gei);
            const pili: PushImpactListenerInvocation = {
                ...gei,
                get project(): GitProject { throw new Error("UnsupportedOperation");},
                get impactedSubProject(): Project { throw new Error("UnsupportedOperation");},
                get filesChanged(): string[] { throw new Error("UnsupportedOperation");},
                commit: gei.goalEvent.push.after,
                push: gei.goalEvent.push,
            };
            return publisher(pili, toArray(fps), {});
        }
        return false;
    };
}
