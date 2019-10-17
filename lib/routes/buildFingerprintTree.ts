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
    FP,
} from "@atomist/sdm-pack-fingerprint";
import { AspectRegistry } from "../aspect/AspectRegistry";
import {
    isSunburstTree,
    PlantedTree,
    SunburstTree,
} from "../tree/sunburst";
import {
    groupSiblings,
    introduceClassificationLayer,
    killChildren,
    trimOuterRim,
    visit,
    visitAsync,
} from "../tree/treeUtils";

import { Aspect } from "@atomist/sdm-pack-fingerprint/lib/machine/Aspect";
import * as _ from "lodash";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    addRepositoryViewUrl,
    splitByOrg,
} from "./support/treeMunging";

/**
 * Return a tree from fingerprint name -> instances -> repos
 * @return {Promise<PlantedTree>}
 */
export async function buildFingerprintTree(
    world: {
        aspectRegistry: AspectRegistry,
        store: ProjectAnalysisResultStore,
    },
    params: {
        workspaceId: string,
        fingerprintName: string,
        fingerprintType: string,
        byName: boolean,
        otherLabel: string,
        byOrg: boolean,
        trim: boolean,
        showProgress: boolean,
    }): Promise<PlantedTree> {

    const { workspaceId, byName, fingerprintName, fingerprintType, otherLabel, byOrg, trim, showProgress } = params;
    const showPresence = !!otherLabel;

    const { store, aspectRegistry } = world;

    // Get the tree and then perform post processing on it
    let pt = await store.fingerprintsToReposTree({
        workspaceId,
        byName,
        otherLabel,
        rootName: fingerprintName,
        aspectName: fingerprintType,
    });
    // logger.debug("Returning fingerprint tree '%s': %j", fingerprintName, pt);

    const aspect = aspectRegistry.aspectOf(fingerprintType);

    if (!byName) {
        // Show all fingerprints in one aspect, splitting by fingerprint name
        pt = introduceClassificationLayer<{ data: any, type: string }>(pt,
            {
                descendantClassifier: l => {
                    if (!(l as any).sha) {
                        return undefined;
                    }
                    const aspect2: Aspect = aspectRegistry.aspectOf(l.type);
                    return !aspect2 || !aspect2.toDisplayableFingerprintName ?
                        l.name :
                        aspect2.toDisplayableFingerprintName(l.name);
                },
                newLayerDepth: 1,
                newLayerMeaning: "fingerprint name",
            });
        if (!!aspect) {
            pt.tree.name = aspect.displayName;
        }
    } else {
        // We are showing a particular fingerprint
        if (!!aspect) {
            pt.tree.name = aspect.toDisplayableFingerprintName ?
                aspect.toDisplayableFingerprintName(fingerprintName) :
                fingerprintName;
        }
    }

    resolveAspectNames(aspectRegistry, pt.tree);

    // if (!showPresence) {
    //     // Suppress branches from aspects that use name "None" for not found
    //     pt.tree = killChildren(pt.tree, c => c.name === "None");
    // }

    if (byOrg) {
        pt = splitByOrg(pt);
    }
    if (showPresence) {
        pt.tree = groupSiblings(pt.tree,
            {
                parentSelector: parent => parent.children.some(c => (c as any).sha),
                childClassifier: kid => (kid as any).sha && kid.name !== "None" ? "Present" : "Absent",
                collapseUnderName: name => name === "Absent",
            });
    }

    if (!showPresence) {
        // Don't do this if we are looking at presence, as sized nodes will swamp absent nodes with default 1
        applyTerminalSizing(aspect, pt.tree);
    }
    pt.tree = addRepositoryViewUrl(pt.tree);

    // Group all fingerprint nodes by their name at the first level
    pt.tree = groupSiblings(pt.tree, {
        parentSelector: parent => parent.children.some(c => (c as any).sha),
        childClassifier: l => l.name,
        collapseUnderName: () => true,
    });

    if (trim) {
        pt.tree = trimOuterRim(pt.tree);
    } else {
        putRepoPathInNameOfRepoLeaves(pt);
    }

    return pt;
}

function resolveAspectNames(aspectRegistry: AspectRegistry, t: SunburstTree): void {
    visit(t, l => {
        if ((l as any).sha) {
            const fp = l as any as FP;
            // It's a fingerprint name
            const aspect = aspectRegistry.aspectOf(fp.type);
            if (aspect) {
                fp.name = aspect.toDisplayableFingerprint ? aspect.toDisplayableFingerprint(fp) : fp.data;
            } else if (!!fp.data && !!fp.data.displayValue) {
                fp.name = fp.data.displayValue;
            } else if (!!fp.displayValue) {
                fp.name = fp.displayValue;
            }
        }
        return true;
    });
}

/**
 * Size terminal nodes by aspect stat if available
 */
function applyTerminalSizing(aspect: Aspect, t: SunburstTree): void {
    if (aspect && aspect.stats && aspect.stats.basicStatsPath) {
        visit(t, l => {
            if (isSunburstTree(l) && l.children.every(c => !isSunburstTree(c) && (c as any).owner)) {
                l.children.forEach(c => (c as any).size = _.get(l, "data." + aspect.stats.basicStatsPath, 1));
            }
            return true;
        });
    }
}

/**
 * Show virtual repos
 * @param {PlantedTree} pt
 */
export function putRepoPathInNameOfRepoLeaves(pt: PlantedTree): void {
    interface EndNode {
        name: string;
        size: number;
        path?: string;
        url?: string;
    }

    visit(pt.tree, l => {
        const en = l as EndNode;
        if (!isSunburstTree(en) && en.name && en.url && en.path) {
            // It's an eligible end node
            en.name = en.name + "/" + en.path;
        }
        return true;
    });
}
