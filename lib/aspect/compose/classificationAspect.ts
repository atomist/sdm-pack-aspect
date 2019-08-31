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

import { Project } from "@atomist/automation-client";
import { PushImpactListenerInvocation } from "@atomist/sdm";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { AspectMetadata } from "./commonTypes";

/**
 * Knows how to classify projects into a unique String
 */
export interface Classifier {

    /**
     * Name of this classifier
     */
    readonly reason: string;

    /**
     * Classification this instance will return
     */
    readonly tags: string | string[];

    /**
     * Test for whether the given project meets this classification
     */
    test: (p: Project, pili: PushImpactListenerInvocation) => Promise<boolean>;
}

export interface ClassificationData {
    tags: string[];

    reasons: string[];
}

export function isClassificationDataFingerprint(fp: FP): fp is FP<ClassificationData> {
    const maybe = fp as FP<ClassificationData>;
    return !!maybe.data && !!maybe.data.tags && !!maybe.data.reasons;
}

/**
 * Classify the project uniquely or otherwise
 * undefined to return no fingerprint
 * @param opts: Whether to allow multiple tags and whether to compute a fingerprint in all cases
 * @param classifiers classifier functions
 */
export function classificationAspect(opts: AspectMetadata & { stopAtFirst?: boolean, alwaysFingerprint?: boolean },
                                     ...classifiers: Classifier[]): Aspect<ClassificationData> {
    return {
        extract: async (p, pili) => {
            const tags: string[] = [];
            const reasons: string[] = [];
            for (const classifier of classifiers) {
                if (await classifier.test(p, pili)) {
                    tags.push(...toArray(classifier.tags));
                    reasons.push(classifier.reason);
                    if (opts.stopAtFirst) {
                        break;
                    }
                }
            }
            const data = { tags: _.uniq(tags).sort(), reasons };
            return (opts.alwaysFingerprint || data.tags.length > 0) ? {
                type: opts.name,
                name: opts.name,
                data,
                // We only sha the tags, not the reason
                sha: sha256(JSON.stringify(data.tags)),
            } : undefined;
        },
        toDisplayableFingerprint: fp => (fp.data.tags && fp.data.tags.join()) || "unknown",
        ...opts,
    };
}
