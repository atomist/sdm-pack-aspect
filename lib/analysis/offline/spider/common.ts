import { RepoId } from "@atomist/automation-client";
import { ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";
import { ProjectAnalysisResultFilter } from "./Spider";

export async function keepExistingPersisted(
    opts: {
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
    },
    repoId: RepoId): Promise<boolean> {

    const found = await opts.persister.loadOne(repoId);
    if (!found) {
        return false;
    }
    return opts.keepExistingPersisted(found);
}
