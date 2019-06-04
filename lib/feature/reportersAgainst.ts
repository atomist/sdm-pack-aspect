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
    treeBuilderFor,
} from "../routes/wellKnownReporters";
import {
    Analyzed,
    FeatureManager,
    Flag,
    HasFingerprints,
} from "./FeatureManager";
import { DefaultAnalyzedRenderer } from "./support/groupingUtils";

import * as _ from "lodash";
import {
    allFingerprints,
    defaultedToDisplayableFingerprint, fingerprintNamesFrom,
} from "./DefaultFeatureManager";
import { Report, Reporter, Reporters } from "./reporters";
import { featureManager } from "../routes/features";

/**
 * Create an object exposing well-known queries against our repo cohort
 * based on the fingerprints the given FeatureManager knows how to manage.
 * Return a query named "flagged" that shows any flagged fingerprints, across all repos.
 * Return 3 queries for each fingerprint name
 * 1. <fingerprintName>: Show distribution of the fingerprint
 * 2. <fingerprintName>-present: Is this fingerprint name present in this repo? Returns for all repos
 * 3. <fingerprintName>-ideal: Show progress toward the ideal for this fingerprint name
 */
export async function reportersAgainst(featureManager: FeatureManager,
                                       repos: Analyzed[] | AsyncIterable<Analyzed>): Promise<Reporters> {
    const reporters: Reporters = {};

    // Report bad fingerprints according to the FeatureManager
    reporters.flagged = params =>
        treeBuilderFor("flagged", params)
            .group({
                name: "flags",
                by: async a => {
                    const knownBad = (await Promise.all(
                        allFingerprints(a).map(fp => featureManager.flags(fp))
                    )).filter(f => !!f && f.length > 0);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        "-" + knownBad.length;
                },
            })
            .group({
                name: "violations",
                by: async a => {
                    const flags = await Promise.all(
                        allFingerprints(a).map(fp => featureManager.flags(fp))
                    );
                    const knownBad: Flag[] = _.flatten(flags.filter(f => !!f && f.length > 0));
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        knownBad.map(bad => bad.message).join(",");
                }
            })
            .renderWith(DefaultAnalyzedRenderer);

    for await (const name of await fingerprintNamesFrom(repos)) {
        for (const report of reportersFor(name, featureManager)) {
            reporters[report.name] = report.reporter;
        }
    }

    return reporters;
}

/**
 * Available reporters for this fingerprint name
 * @param {string} fingerprintName
 * @param {FeatureManager} featureManager
 * @return {Report[]}
 */
export function reportersFor(fingerprintName: string, featureManager: FeatureManager): Report[] {
    return [
        { name: fingerprintName, reporter: skewReport(fingerprintName, featureManager) },
        { name: fingerprintName + "-present", reporter: presenceReport(fingerprintName, featureManager) },
        { name: fingerprintName + "-ideal", reporter: skewReport(fingerprintName, featureManager) },
    ]
}

export function skewReport(fingerprintName: string, featureManager: FeatureManager): Reporter {
    return params =>
        treeBuilderFor(fingerprintName, params)
            .group({
                name: fingerprintName,
                by: ar => {
                    const fp = ar.fingerprints[fingerprintName];
                    return !!fp ? defaultedToDisplayableFingerprint(featureManager.featureFor(fp))(fp) : undefined;
                },
            })
            .renderWith(DefaultAnalyzedRenderer);
}

export function idealProgressReport(fingerprintName: string, featureManager: FeatureManager): Reporter {
    return params =>
        treeBuilderFor(fingerprintName, params)
            .group({
                name: fingerprintName + " ideal?",
                by: async ar => {
                    const fp = ar.fingerprints[fingerprintName];
                    const ideal = await featureManager.idealResolver(fingerprintName);
                    if (!ideal.ideal) {
                        return !fp ? `Yes (gone)` : "No (present)";
                    }
                    if (!fp) {
                        return undefined;
                    }
                    const feature = featureManager.featureFor(fp);
                    if (ideal && ideal.ideal) {
                        return fp.sha === ideal.ideal.sha ? `Yes (${defaultedToDisplayableFingerprint(feature)(ideal.ideal)})` : "No";
                    }
                    return !!fp ? defaultedToDisplayableFingerprint(feature)(fp) : undefined;
                },
            })
            .renderWith(DefaultAnalyzedRenderer);
}

export function presenceReport(name: string, featureManager: FeatureManager): Reporter {
    return params =>
        treeBuilderFor(name, params)
            .group({
                name,
                by: ar => {
                    const fp = ar.fingerprints[name];
                    return !!fp ? "Yes" : "No";
                },
            })
            .renderWith(DefaultAnalyzedRenderer);
}

export interface DisplayableFingerprint {
    name: string;
    readable: string;
    ideal?: string;
}

export async function fingerprintsFound(fm: FeatureManager, ar: HasFingerprints): Promise<DisplayableFingerprint[]> {
    const results: DisplayableFingerprint[] = [];
    const fingerprints = allFingerprints(ar);
    for (const instance of fingerprints) {
        const hideal = await fm.idealResolver(instance.name);
        const huck = fm.featureFor(instance);
        if (huck) {
            results.push({
                name: instance.name,
                readable: defaultedToDisplayableFingerprint(huck)(instance),
                ideal: defaultedToDisplayableFingerprint(huck)(hideal.ideal),
            });
        }
    }
    return results;
}
