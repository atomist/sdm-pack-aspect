import * as React from "react";

interface AnalysisTrackingRepo {
    description: string;
    progress: "Planned" | "Going" | "Stopped";
    keptExisting: boolean;
    millisTaken?: number;
}
interface AnalysisTrackingAnalysis {
    description: string;
    analysisKey: string;
    progress: "Going" | "Stopped";
    repos: AnalysisTrackingRepo[];
}

export interface AnalysisTrackingProps {
    analyses: AnalysisTrackingAnalysis[];
}

function displayRepository(repo: AnalysisTrackingRepo & { repoAnalysisId: string }): React.ReactElement {
    let className = "analysisTrackingRepo " + repo.progress;
    if (repo.keptExisting) {
        className += " keptExistingAnalysis";
    }
    const timeTaken = repo.millisTaken ? `Took ${repo.millisTaken / 1000}s` : undefined;
    return <div className={className}><p>{repo.description}</p> <span className="timeTakenToAnalyzeRepo">{timeTaken}</span></div>;
}

function listRepositories(title: string, repos: AnalysisTrackingRepo[]): React.ReactElement {
    return <div className="repoList">{title}
        {repos.map((r, i) => displayRepository({ ...r, repoAnalysisId: "" + i }))}
    </div>;
}

function displayAnalysis(analysis: AnalysisTrackingAnalysis): React.ReactElement {
    const analysisStatusClass = analysis.progress === "Going" ? "ongoingAnalysis" : "nongoingAnalysis";
    return <div className={analysisStatusClass}>
        {analysis.description}
        <h4>Repositories:</h4>
        <div className="repositoryColumns">
            {listRepositories("Planned", analysis.repos.filter(r => r.progress === "Planned"))}
            {listRepositories("Going", analysis.repos.filter(r => r.progress === "Going"))}
            {listRepositories("Stopped", analysis.repos.filter(r => r.progress === "Stopped"))}
        </div>
    </div>;
}

function listAnalyses(analyses: AnalysisTrackingAnalysis[]): React.ReactElement {
    return <div className="analysisList">{analyses.map(displayAnalysis)}</div>;
}

export function AnalysisTrackingPage(props: AnalysisTrackingProps): React.ReactElement {
    if (props.analyses.length === 0) {
        return <div>No analyses in progress.
            Start one at the command line:{" "}
            <span className="typeThisAtCommandLine">atomist analyze local repositories</span></div>;
    }
    return <div>{listAnalyses(props.analyses)}</div>;
}
