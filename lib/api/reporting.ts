import { Analyzed, FeatureManager } from "../feature/FeatureManager";
import { reportersAgainst, reportersFor } from "../feature/reportersAgainst";
import { SunburstTree } from "../tree/sunburst";

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

// export async function* runReports(featureManager: FeatureManager,
//                                   repos: Analyzed[] | AsyncIterable<Analyzed>,
//                                   names: string[]): AsyncIterable<Promise<SunburstTree>> {
//     const fingerprintNames = names.filter(name => !name.includes("-"));
//     for (const name of fingerprintNames) {
//         const reports = reportersFor(name, featureManager);
//         for (const report of reports) {
//             yield report.reporter({ byOrg: true }).toSunburstTree(() => repos);
//         }
//     }
// }