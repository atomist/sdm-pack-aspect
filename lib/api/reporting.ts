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

import { Analyzed, FeatureManager } from "../feature/FeatureManager";
import { reportersAgainst, reportersFor } from "../feature/reportersAgainst";
import { mergeTrees, SunburstTree } from "../tree/sunburst";
import { Report } from "../feature/reporters";

/**
 * Discover the reports available on this cohort of repos
 * @param {FeatureManager} featureManager
 * @param {Analyzed[] | AsyncIterable<Analyzed>} repos
 * @return {Promise<Report[]>}
 */
export async function availableReports(featureManager: FeatureManager,
                                       repos: Analyzed[] | AsyncIterable<Analyzed>): Promise<Report[]> {
    const reporters = await reportersAgainst(featureManager, repos);
    return Object.getOwnPropertyNames(reporters)
        .map(name => ({
            name,
            reporter: reporters[name],
        }));
}

type Trees = Record<string, SunburstTree>;

/**
 * Object that can persist the additional tree data
 */
export interface TreesMerge {
    merge(extraTrees: Trees): Promise<void>;
}

/**
 * Run reports, persisting them in the treesMerge structure
 * @param {FeatureManager} featureManager
 * @param {Analyzed[] | AsyncIterable<Analyzed>} repos
 * @param {TreesMerge} treesMerge
 * @param {string[]} names
 * @return {Promise<void>}
 */
export async function runReports(featureManager: FeatureManager,
                                 repos: Analyzed[] | AsyncIterable<Analyzed>,
                                 treesMerge: TreesMerge,
                                 names: string[],
                                 pageSize: number): Promise<void> {
    const fingerprintNames = names.filter(name => !(name.endsWith("-ideal") || name.endsWith("-present")));
    const reports: Report[] = [];
    for (const name of fingerprintNames) {
        reports.push(...reportersFor(name, featureManager));
    }
    console.log(`Running ${reports.length} reports`);
    await runReportsByPage(repos, reports, treesMerge, pageSize);
}

export class InMemoryTreesMerge implements TreesMerge {

    public readonly trees: Trees = {};

    public async merge(extraTrees: Trees): Promise<void> {
        for (const treeName of Object.getOwnPropertyNames(extraTrees)) {
            if (!this.trees[treeName]) {
                this.trees[treeName] = extraTrees[treeName];
            } else {
                this.trees[treeName] = mergeTrees(this.trees[treeName], extraTrees[treeName]);
            }
        }
    }

}

// Chunk it into trees of size n
async function runReportsByPage(repos: AsyncIterable<Analyzed> | Analyzed[],
                                reports: Report[],
                                treesMerge: TreesMerge,
                                pageSize: number): Promise<void> {

    async function runReports() {
        const extraTrees = await reportAgainstPage(data, reports);
        return treesMerge.merge(extraTrees);
    }

    let data: Analyzed[] = [];
    for await (const root of repos) {
        data.push(root);
        if (data.length === pageSize) {
            await runReports();
            console.log(`Emitted trees of size ${pageSize}`);
            data = [];
        }
    }
    await runReports();
}

async function reportAgainstPage(data: Analyzed[], reports: Report[]): Promise<Trees> {
    const results = await Promise.all(
        reports.map(report => {
                return report.reporter({ byOrg: true }).toSunburstTree(() => data).then(tree => ({
                    name: report.name,
                    tree,
                }))
            }
        ));
    const trees: Trees = {};
    results.forEach(result => trees[result.name] = result.tree);
    return trees;
}