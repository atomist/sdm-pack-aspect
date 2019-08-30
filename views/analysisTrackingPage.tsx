import * as React from "react";

interface AnalysisTrackingRepo {
    description: string;
    url?: string;
    progress: "Planned" | "Going" | "Stopped";
    keptExisting: boolean;
    millisTaken?: number;
    errorMessage?: string;
    stackTrace?: string;
    snapshotId?: string;
}
interface AnalysisTrackingAnalysis {
    description: string;
    analysisKey: string;
    progress: "Going" | "Stopped";
    repos: AnalysisTrackingRepo[];
    error?: Error;
}

export interface AnalysisTrackingProps {
    analyses: AnalysisTrackingAnalysis[];
}

function displayRepository(repo: AnalysisTrackingRepo & { repoAnalysisId: string }): React.ReactElement {
    let className = "analysisTrackingRepo " + repo.progress;
    if (repo.keptExisting) {
        className += " keptExistingAnalysis";
    }
    if (repo.errorMessage) {
        className += " failed";
    }
    const timeTaken = repo.millisTaken ? `Took ${repo.millisTaken / 1000}s` : undefined;
    const gitLink = repo.url ? <a href={repo.url}><img src="/git.png" className="linkToSourceImage"></img></a> : undefined;
    const insightsLink = repo.snapshotId ? <a href={"/repository?id=" + repo.snapshotId}>
        <img src="/hexagonal-fruit-of-power.png" className="linkToInsightsImage"></img>
    </a> : undefined;
    return <div className={className}>
        <p className="analysisRepoDescription">{repo.description} {gitLink} {insightsLink} </p>
        <span className="timeTakenToAnalyzeRepo">{timeTaken}</span>
        {displayFailure(repo)}
    </div>;
}

function displayFailure(repo: AnalysisTrackingRepo): React.ReactElement {
    if (!repo.errorMessage) {
        return undefined;
    }
    return <div className="analyzeRepoError">
        <p>{repo.errorMessage}</p>
        <pre>{repo.stackTrace}</pre>
    </div>;
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
        {displayAnalysisFailure(analysis)}
        <h4>Repositories:</h4>
        <div className="repositoryColumns">
            {listRepositories("Planned", analysis.repos.filter(r => r.progress === "Planned"))}
            {listRepositories("Going", analysis.repos.filter(r => r.progress === "Going"))}
            {listRepositories("Finished", analysis.repos.filter(r => r.progress === "Stopped"))}
        </div>
    </div>;
}

function displayAnalysisFailure(analysis: AnalysisTrackingAnalysis): React.ReactElement {
    if (!analysis.error) {
        return undefined;
    }
    return <div className="analyzeRepoErrors">
        <p>{analysis.error.message}</p>
        <pre>{analysis.error.stack}</pre>
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
