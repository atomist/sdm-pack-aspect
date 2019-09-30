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
import { isInLocalMode } from "@atomist/sdm-core";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    FP, sha256,
} from "@atomist/sdm-pack-fingerprint";
import * as _ from "lodash";
import {
    RepoToScore,
    Tagger,
} from "../AspectRegistry";
import { AspectMetadata } from "./commonTypes";

export interface Classifier {

    /**
     * Reason for this classification.
     */
    readonly reason: string;

    /**
     * Classification this instance will return
     */
    readonly tags: string | string[];
}

export interface ProjectClassifier extends Classifier {
    /**
     * Test for whether the given project meets this classification
     */
    test: (p: Project, pili: PushImpactListenerInvocation) => Promise<boolean>;
}

export interface DerivedClassifier extends Classifier {
    /**
     * Test for whether the given project meets this classification
     */
    testFingerprints: (fps: FP[], p: Project, pili: PushImpactListenerInvocation) => Promise<boolean>;
}

export type EligibleClassifier = ProjectClassifier | DerivedClassifier | Tagger;

function isProjectClassifier(c: EligibleClassifier): c is ProjectClassifier {
    const maybe = c as ProjectClassifier;
    return !!maybe.test && !!maybe.reason && !!maybe.tags;
}

function isDerivedClassifier(c: EligibleClassifier): c is DerivedClassifier {
    const maybe = c as DerivedClassifier;
    return !!maybe.testFingerprints;
}

function isTagger(c: EligibleClassifier): c is Tagger {
    const maybe = c as Tagger;
    return !!maybe.test && !!maybe.name;
}

export interface ClassificationData {

    /**
     * Description for this classification
     */
    readonly description: string;

    /**
     * Reason for this specific classification decision
     */
    readonly reason: string;
}

export function isClassificationDataFingerprint(fp: FP): fp is FP<ClassificationData> {
    const maybe = fp as FP<ClassificationData>;
    return !!maybe.data && !!maybe.data.reason;
}

export type ClassificationAspect = Aspect<ClassificationData> & { classifierMetadata: Classifier[] };

export function isClassificationAspect(a: Aspect): a is ClassificationAspect {
    const maybe = a as ClassificationAspect;
    return !!maybe.classifierMetadata;
}

export interface ClassificationOptions extends AspectMetadata {

    /**
     * Stop at the first matched tag?
     */
    stopAtFirst?: boolean;
}

/**
 * Classify the project uniquely or otherwise
 * undefined to return no fingerprint
 * @param opts: Whether to allow multiple tags and whether to compute a fingerprint in all cases
 * @param classifiers classifier functions
 */
export function projectClassificationAspect(opts: ClassificationOptions, ...classifiers: EligibleClassifier[]): ClassificationAspect {
    const projectClassifiers = classifiers.filter(isProjectClassifier);
    const derivedClassifiers = [
        ...classifiers.filter(isDerivedClassifier),
        ...classifiers.filter(isTagger).map(toDerivedClassifier),
    ];

    return {
        classifierMetadata: _.flatten([...projectClassifiers, ...derivedClassifiers].map(c => ({
            reason: c.reason,
            tags: c.tags,
        }))),
        extract: async (p, pili) => {
            const emitter = emitFingerprints(projectClassifiers, opts);
            return emitter([], p, pili);
        },
        consolidate: async (fps, p, pili) => {
            const test = emitFingerprints(derivedClassifiers, opts);
            return test(fps, p, pili);
        },
        toDisplayableFingerprint: fp => fp.name,
        ...opts,
    };
}

function toDerivedClassifier(tagger: Tagger): DerivedClassifier {
    return {
        tags: [tagger.name],
        reason: tagger.description,
        testFingerprints: async (fingerprints, p) => {
            const rts: RepoToScore = {
                analysis: {
                    id: p.id,
                    fingerprints,
                },
            };
            return tagger.test(rts);
        },
    };
}

function emitFingerprints(classifiers: Classifier[], opts: ClassificationOptions):
    (fps: FP[], p: Project, pili: PushImpactListenerInvocation) => Promise<Array<FP<ClassificationData>>> {

    return async (fps, p, pili) => {
        const found: Array<FP<ClassificationData>> = [];

        function recordFingerprint(name: string, reason: string): void {
            if (!found.some(fp => fp.name === name)) {
                found.push({
                    type: opts.name,
                    name,
                    data: { description: opts.displayName, reason },
                    sha: sha256({ present: true }),
                });
            }
        }

        // Don't re-evaluate if we've already seen the tag
        const classifierMatches = async (classifier, ifps, ip, ipili) =>
            !_.includes(found.map(f => f.name), classifier.tags) &&
                isProjectClassifier(classifier) ?
                classifier.test(ip, ipili) :
                classifier.testFingerprints(ifps, ip, ipili);

        if (opts.stopAtFirst || !isInLocalMode()) {
            // Ordering is important. Execute in series and stop when we find a match.
            // Also team mode requires serial execution
            for (const classifier of classifiers) {
                if (await classifierMatches(classifier, fps, p, pili)) {
                    for (const name of toArray(classifier.tags)) {
                        recordFingerprint(name, classifier.reason);
                    }
                    if (opts.stopAtFirst) {
                        break;
                    }
                }
            }
        } else {
            // Ordering is not important. We can run in parallel
            await Promise.all(
                classifiers.map(classifier => {
                    return classifierMatches(classifier, fps, p, pili)
                        .then(result => result ? ({
                            tags: toArray(classifier.tags),
                            reason: classifier.reason,
                        }) : undefined)
                        .then(st => {
                            if (st) {
                                for (const name of st.tags) {
                                    recordFingerprint(name, st.reason);
                                }
                            }
                        });
                }));
        }
        return found;
    };
}
