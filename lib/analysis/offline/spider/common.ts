import { GitCommandGitProject, isLocalProject, Project, RemoteRepoRef, RepoId } from "@atomist/automation-client";
import { isInMemoryProject } from "@atomist/automation-client/lib/project/mem/InMemoryProject";
import { ProjectAnalyzer, Interpretation, ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import * as path from "path";
import { SubprojectDescription } from "../../ProjectAnalysisResult";
import { SubprojectStatus } from "../../subprojectFinder";
import { ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";
import { ScmSearchCriteria } from "./ScmSearchCriteria";
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

export interface AnalyzeResults {
    repoInfos: RepoInfo[];
    projectsDetected: number;
}

export interface RepoInfo {
    readme: string;
    totalFileCount: number;
    interpretation: Interpretation;
    analysis: ProjectAnalysis;
    subproject: SubprojectDescription;
}
/**
 * Find project or subprojects
 */
export async function analyze(project: Project,
    analyzer: ProjectAnalyzer,
    criteria: ScmSearchCriteria): Promise<AnalyzeResults> {

    const subprojectResults = criteria.subprojectFinder ?
        await criteria.subprojectFinder.findSubprojects(project) :
        { status: SubprojectStatus.Unknown };
    if (!!subprojectResults.subprojects && subprojectResults.subprojects.length > 0) {
        const repoInfos = await Promise.all(subprojectResults.subprojects.map(subproject => {
            return projectUnder(project, subproject.path).then(p =>
                analyzeProject(
                    p,
                    analyzer,
                    { ...subproject, parentRepoRef: project.id as RemoteRepoRef }));
        })).then(results => results.filter(x => !!x));
        return {
            projectsDetected: subprojectResults.subprojects.length,
            repoInfos,
        };
    }
    return { projectsDetected: 1, repoInfos: [await analyzeProject(project, analyzer, undefined)] };
}

/**
 * Analyze a project. May be a virtual project, within a bigger project.
 */
async function analyzeProject(project: Project,
    analyzer: ProjectAnalyzer,
    subproject?: SubprojectDescription): Promise<RepoInfo> {
    const readmeFile = await project.getFile("README.md");
    const readme = !!readmeFile ? await readmeFile.getContent() : undefined;
    const totalFileCount = await project.totalFileCount();

    const analysis = await analyzer.analyze(project, undefined, { full: true });
    const interpretation = await analyzer.interpret(analysis, undefined);

    return {
        readme,
        totalFileCount,
        interpretation,
        analysis,
        subproject,
    };
}

async function projectUnder(p: Project, pathWithin: string): Promise<Project> {
    if (isInMemoryProject(p)) {
        // TODO we need latest automation-client but this isn't available
        // return p.toSubproject(pathWithin);
    }
    if (!isLocalProject(p)) {
        throw new Error(`Cannot descend into path '${pathWithin}' of non local project`);
    }
    const rid = p.id as RemoteRepoRef;
    const newId: RemoteRepoRef = {
        ...rid,
        path: pathWithin,
    };
    return GitCommandGitProject.fromBaseDir(
        newId,
        path.join(p.baseDir, pathWithin),
        (p as any).credentials,
        p.release,
    );
}
