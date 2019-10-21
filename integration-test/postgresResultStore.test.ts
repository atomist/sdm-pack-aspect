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

import { PostgresProjectAnalysisResultStore } from "../lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { sdmConfigClientFactory } from "../lib/analysis/offline/persist/pgClientFactory";
import * as assert from "power-assert";
import { ProjectAnalysisResult } from "../lib/analysis/ProjectAnalysisResult";
import {
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import {
    driftTreeForAllAspects,
    fingerprintsToReposTreeQuery,
} from "../lib/analysis/offline/persist/repoTree";
import { DoWithClientError } from "../lib/analysis/offline/persist/pgUtils";
import { computeAnalytics } from "../lib/analysis/offline/spider/analytics";
import * as _ from "lodash"; // default import does not work with our mocha command
import { PersistResult } from "../lib/analysis/offline/persist/ProjectAnalysisResultStore";

describe("Postgres Result Store", () => {
    it("stores analysis and retrieves it", async () => {
        const subject = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory({}));

        const workspaceId1 = "TJVC";
        const workspaceId2 = "ARGO";
        const fingerprintToStore: FP<any> = {
            type: "MST3k",
            name: "Rowsdower",
            displayName: "The Loyal Traitor",
            sha: "8x4d",
            data: { yell: "ROWSDOWER!!!" },
            path: "/hey"
        }
        const repoRef = {
            owner: "satellite-of-love",
            repo: "rowsdower",
            url: "https://github.com/satellite-of-love/rowsdower",
            sha: "37787bc4241ff3d3fad165c5b30882ba7603d771",
        };
        const analysis: ProjectAnalysisResult = {
            repoRef,
            workspaceId: workspaceId1,
            timestamp: new Date(),
            analysis: {
                id: repoRef,
                fingerprints: [fingerprintToStore]
            }
        };

        const persistResult = await subject.persist(analysis);

        // Spot persistence failures early
        console.log(JSON.stringify(persistResult, null, 2));
        assert.strictEqual(persistResult.failed.length, 0, "Failures: " + persistResult.failed.map(f => f.message).join(", "));
        assert.strictEqual(persistResult.failedFingerprints.length, 0,
            "Failures: " + persistResult.failedFingerprints.map(f => f.error).join(", "));
        assert(persistResult.succeeded.length > 0, "reports something was persisted");

        // Now store the same thing, but in a different workspace.
        const persistResult2 = await subject.persist({ ...analysis, workspaceId: workspaceId2 });
        assert(persistResult2.succeeded.length > 0, "reports something was persisted in workspace 2");


        // retrieve
        const distinct = false;
        const allFingerprintsInWorkspace = await subject.fingerprintsInWorkspace(workspaceId1, distinct);
        assert.strictEqual(allFingerprintsInWorkspace.length, 1, "expected 1 fingerprint in workspace");
        const retrievedFingerprint = allFingerprintsInWorkspace[0];
        assert.deepEqual(retrievedFingerprint, { ...fingerprintToStore, id: retrievedFingerprint.id },
            "It should match what was stored, with the addition of id");

        // try {
        // retrieve another way
        const loadedByRepoRef1 = await subject.loadByRepoRef(workspaceId1, repoRef, false);
        assert(!!loadedByRepoRef1, "Wanna get one");
        console.log("Shallow loadByRepoRef was successful")
        const loadedByRepoRefDeep = await subject.loadByRepoRef(workspaceId1, repoRef, true);
        console.log("Deep load by reporef has returned")
        assert.deepStrictEqual(loadedByRepoRefDeep.analysis.fingerprints.length, 1, "Should be the same as was stored");
        assert.deepStrictEqual(loadedByRepoRefDeep.analysis.fingerprints[0].displayName, "The Loyal Traitor", "Should be about the same as was stored");
        // } catch (err) {
        //     assert.fail(err.message + "\n" + (err as DoWithClientError).operationDescription);
        // }

        const loadedById = await subject.loadById(persistResult.succeeded[0], false, workspaceId1);
        assert(!!loadedById, "Wanna get one by ID");
    });
    it("Can aggregate only within a workspace", async () => {

        const subject = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory({}));

        const workspaceId1 = "TJVC-agg";
        const workspaceId2 = "ARGO-agg";
        const fingerprintToStore: FP<any> = {
            type: "MST3k",
            name: "Rowsdower",
            displayName: "The Loyal Traitor",
            sha: "8x4d",
            data: { yell: "ROWSDOWER!!!" },
            path: "/hey"
        }
        const repoRef = {
            owner: "satellite-of-love",
            repo: "rowsdower",
            url: "https://github.com/satellite-of-love/rowsdower",
            sha: "37787bc4241ff3d3fad165c5b30882ba7603d771",
        };
        const analysis: ProjectAnalysisResult = {
            repoRef,
            workspaceId: workspaceId1,
            timestamp: new Date(),
            analysis: {
                id: repoRef,
                fingerprints: [fingerprintToStore]
            }
        };

        // store analyses with 2 different variants in workspace1; then one of the same ones in workspace2
        // and finally a third in workspace2 -- with an extra fingerprint name not seen in the first workspace.
        // Each workspace should see 2 variants, and not the variant that's only in the other.

        {
            const persistResult = await subject.persist(analysis);
            lookSuccessful("first", persistResult);
        }
        _.merge(analysis,
            {
                repoRef: { repo: "servo", url: "https://github.com/satellite-of-love/servo" },
                analysis: { fingerprints: { 0: { sha: "349857", data: { yell: "wat" } } } }
            });
        {
            const persistResult = await subject.persist(analysis);
            lookSuccessful("second", persistResult);
        }
        _.merge(analysis, {
            workspaceId: workspaceId2,
            analysis: {
                fingerprints: { 0: { displayName: "That dirty traitor" } } // this might break it
            }
        });
        {     // Now store the same thing, but in a different workspace.
            const persistResult2 = await subject.persist(analysis);
            lookSuccessful("other workspace", persistResult2);
        }
        _.merge(analysis,
            {
                repoRef: { repo: "tombinh", url: "https://github.com/satellite-of-love/tombinh" },
                analysis: {
                    fingerprints: {
                        0: { sha: "873yfhrsd", data: { yell: "consent" } },
                        1: { ...fingerprintToStore, type: "MST3k", name: "Mitchell", displayName: "MITCHELL" }
                    }
                }
            });
        {     // Now store another different thing, in the second workspace
            const persistResult2 = await subject.persist(analysis);
            lookSuccessful("other workspace", persistResult2);
        }

        // analyze, to get the fingerprint_analytics populated for both workspaces
        await computeAnalytics({
            persister: subject,
            analyzer: { aspectOf() { return {} as Aspect } }
        },
            workspaceId1);
        await computeAnalytics({
            persister: subject,
            analyzer: { aspectOf() { return {} as Aspect } }
        },
            workspaceId2);

        // now! Test the aggregate selection methods

        const fingerprintUsage = await subject.fingerprintUsageForType(workspaceId1);
        assert.strictEqual(fingerprintUsage.length, 1, "Better be one usage too");
        const fu = fingerprintUsage[0];
        assert.strictEqual(fu.variants, 2, "We made two variants of this one in the workspace");

        //console.log(fu);

        // next aggregate method
        const ftrTreeQueryResult = await fingerprintsToReposTreeQuery({
            workspaceId: workspaceId1,
            aspectName: "MST3k",
            rootName: "*",
            byName: false,
            otherLabel: "Moar",
        }, sdmConfigClientFactory({}));

        console.log(JSON.stringify(ftrTreeQueryResult.tree, null, 2));

        assert.strictEqual(ftrTreeQueryResult.tree.children.length, 2, "There should be 2 variants in this tree");

        // // and the drift tree
        // const driftTreeResult = await driftTreeForAllAspects();

        // const kinds = await subject.distinctFingerprintKinds();

        // subject.deleteOldSnapshotForRepository();

        // subject.fingerprintsForProject();

        // subject.averageFingerprintCount();

        // subject.distinctRepoFingerprintKinds();


    })
});

function lookSuccessful(description: string, persistResult: PersistResult) {
    console.log(JSON.stringify(persistResult, null, 2));
    assert.strictEqual(persistResult.failed.length, 0, description + "Failures: " + persistResult.failed.map(f => f.message).join(", "));
    assert.strictEqual(persistResult.failedFingerprints.length, 0,
        description + "Failures: " + persistResult.failedFingerprints.map(f => f.error).join(", "));
    assert(persistResult.succeeded.length > 0, description + "reports something was persisted");

}