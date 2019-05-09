import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { RemoteRepoRef } from "@atomist/automation-client";

/**
 * The result of running one analysis. Allows us to attach further information,
 * such as provenance if we spidered it.
 */
export interface ProjectAnalysisResult {

    readonly analysis: ProjectAnalysis;

    /**
     * Date of this analysis
     */
    readonly timestamp: Date;

    /**
     * Id of the enclosing project if this is a virtual project
     */
    readonly parentId: RemoteRepoRef;

}

export function isProjectAnalysisResult(r: any): r is ProjectAnalysisResult {
    const maybe = r as ProjectAnalysisResult;
    return !!maybe.analysis;
}
