import { Project } from "@atomist/automation-client";
import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import { FP, sha256, Aspect } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import * as path from "path";

interface TypeScriptSourceDirectoriesFingerprintData { directories: string[]; }

const TypeScriptSourceDirectoriesAspectName = "TypeScriptSourceDirectories";

const TypeScriptSourceCountByDirectoryFingerprintName = "TypeScriptSourceCountByDirectory";

function toTypeScriptSourceDirectoriesFingerprint(data: TypeScriptSourceDirectoriesFingerprintData):
    FP<TypeScriptSourceDirectoriesFingerprintData> {
    return {
        name: TypeScriptSourceCountByDirectoryFingerprintName,
        type: TypeScriptSourceDirectoriesAspectName,
        data,
        sha: sha256(JSON.stringify(data)),
    };
}

export const extractTypeScriptSourceDirectories:
    (p: Project) => Promise<Array<FP<TypeScriptSourceDirectoriesFingerprintData>>> = async p => {
        const allDirs = await gatherFromFiles(p, "**/*.ts", async f => path.dirname(f.path));
        if (!allDirs || allDirs.length === 0) {
            return [];
        }
        const filesByPath = _.groupBy(allDirs);
        const counts = Object.keys(filesByPath).map(dir => {
            return { name: dir, count: filesByPath[dir].length };
        }).sort(byCountAndThenName);
        return [toTypeScriptSourceDirectoriesFingerprint({ directories: counts.map(c => c.name) })];
    };

function byCountAndThenName<T extends { name: string, count: number }>(a: T, b: T): number {
    if (a.count > b.count) { return -1; }
    if (b.count > a.count) { return 1; }

    if (a.name > b.name) { return 1; }
    if (b.name > a.name) { return -1; }
    return 0;
}

export const TypeScriptSourceDirectoriesAspect: Aspect<TypeScriptSourceDirectoriesFingerprintData> {

}
