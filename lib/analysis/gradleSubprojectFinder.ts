import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import * as _ from "lodash";
import { SubprojectFinder } from "./subprojectFinder";
import { SubprojectStatus } from "./subprojectFinder";

export const GradleSubprojectFinder: SubprojectFinder = async p => {
    if (await p.hasFile("build.gradle")) {
        return {
            status: SubprojectStatus.RootOnly,
        };
    }
    const gradleFiles = await gatherFromFiles(p,
        "**/build.gradle",
        async f => _.dropRight(f.path.split("/")).join("/"));
    const paths = _.dropRight(gradleFiles, 1);
    if (paths.length > 0) {
        console.log(`The paths within ${p.id.url} are ${paths}`);
        return {
            status: SubprojectStatus.IdentifiedPaths,
            paths,
        }
    }
    return {
        status: SubprojectStatus.Unknown,
    };
};
