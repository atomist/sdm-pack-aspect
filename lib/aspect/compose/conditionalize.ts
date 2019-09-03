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
    logger,
    Project,
} from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { AspectMetadata } from "./commonTypes";

/**
 * Make this aspect conditional
 */
export function conditionalize<DATA = any>(aspect: Aspect<DATA>,
                                           test: (p: Project) => Promise<boolean>,
                                           details: Partial<AspectMetadata> = {}): Aspect<DATA> {
    const metadata: AspectMetadata = {
        ...aspect,
        ...details,
    };
    return {
        ...metadata,
        extract: async (p, pli) => {
            const testResult = await test(p);
            if (testResult) {
                const rawFingerprints = toArray(await aspect.extract(p, pli));
                return rawFingerprints.map(raw => {
                    const merged: FP<DATA> = {
                        ...raw,
                        type: metadata.name,
                    };
                    logger.debug("Merged fingerprints=%j", merged);
                    return merged;
                });
            }
            return undefined;
        },
    };
}
