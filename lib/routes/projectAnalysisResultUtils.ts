import * as _ from "lodash";
import * as path from "path";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { Renderer } from "../tree/TreeBuilder";

export type ProjectAnalysisResultGrouper = (ar: ProjectAnalysisResult) => string;

export const OrgGrouper: ProjectAnalysisResultGrouper = a => _.get(a, "analysis.id.owner");

export const DefaultProjectAnalysisResultRenderer: Renderer<ProjectAnalysisResult> =
    ar => {
        const projectName = ar.analysis.id.path ?
            ar.analysis.id.repo + path.sep + ar.analysis.id.path :
            ar.analysis.id.repo;
        const url = ar.analysis.id.path ?
            ar.analysis.id.url + "/tree/" + (ar.analysis.id.sha || "master") + "/" + ar.analysis.id.path :
            ar.analysis.id.url;

        return {
            name: projectName,
            size: 1,
            url,
            repoUrl: ar.analysis.id.url,
        };
    };
