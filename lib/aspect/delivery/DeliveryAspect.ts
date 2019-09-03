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
    GoalExecutionListenerInvocation,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { AllGoals } from "@atomist/sdm-core";
import {
    Aspect,
    FP,
    PublishFingerprints,
} from "@atomist/sdm-pack-fingerprint";

/**
 * Aspect that can register to extract fingerprints from Atomist events
 */
export interface DeliveryAspect<GOALS extends AllGoals, DATA = any> extends Aspect<DATA> {

    /**
     * Can this delivery aspect be registered given these goals
     */
    canRegister(sdm: SoftwareDeliveryMachine, goals: GOALS): boolean;

    /**
     * Cause this to emit fingerprints
     */
    register(sdm: SoftwareDeliveryMachine, deliveryGoals: GOALS, publisher: PublishFingerprints): void;

}

export function isDeliveryAspect(a: Aspect): a is DeliveryAspect<any> {
    const maybe = a as DeliveryAspect<any>;
    return !!maybe.register;
}
