import { Project } from "@atomist/automation-client";
import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import { FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import * as path from "path";

type TypeScriptSourceDirectoriesFingerprintData = Array<{
    dir: string, tsFileCount: number,
}>;

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
            return { dir, tsFileCount: filesByPath[dir].length };
        }).sort(c => 0 - c.tsFileCount);
        console.log("JESS " + JSON.stringify(counts));
        return [toTypeScriptSourceDirectoriesFingerprint(counts)];
    };
