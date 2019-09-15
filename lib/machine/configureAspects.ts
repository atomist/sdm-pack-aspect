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

import { Configuration } from "@atomist/automation-client";
import { PushImpact } from "@atomist/sdm";
import {
    configure,
    DeliveryGoals,
} from "@atomist/sdm-core";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    RebaseFailure,
    RebaseStrategy,
} from "@atomist/sdm-pack-fingerprint";
import { DeepPartial } from "ts-essentials";
import {
    aspectSupport,
    AspectSupportOptions,
} from "./aspectSupport";

// This SDM only has a single PushImpact goal which is used
// to run your aspects on Git pushes
interface AnalyzeGoals extends DeliveryGoals {

    pushImpact: PushImpact;
}

/**
 * Configure a single or multiple aspects with an SDM
 */
export async function configureAspects(aspects: Aspect | Aspect[],
                                       options: DeepPartial<AspectSupportOptions> = {}): Promise<Configuration> {
    return configure<AnalyzeGoals>(async sdm => {
        // This creates and configures the goal instance
        const goals = await sdm.createGoals(async () => ({ pushImpact: new PushImpact() }));

        // This installs the required extension pack into the SDM
        // to run aspects and expose the local web ui for testing
        sdm.addExtensionPacks(
            aspectSupport({

                // Pass the aspects you want to run in this SDM
                aspects: toArray(aspects),

                // Pass the PushImpact goal into the aspect support for it
                // to get configured
                goals,

                // Configure how existing branches should be rebased
                // during aspect apply executions
                rebase: {
                    rebase: true,
                    rebaseStrategy: RebaseStrategy.Ours,
                    onRebaseFailure: RebaseFailure.DeleteBranch,
                },

                ...options as any,
            }),
        );

        // Return a signal goal set to run the push impact goal
        // on any push
        return {
            analyze: {
                goals: goals.pushImpact,
            },
        };
    });
}
