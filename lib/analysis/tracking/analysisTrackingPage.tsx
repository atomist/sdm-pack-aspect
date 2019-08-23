import * as React from "react";

interface AnalysisTrackingRepo {
    description: string;
}
interface AnalysisTrackingAnalysis {
    description: string;
    analysisId: string;
    progress: "Going" | "Stopped";
    plannedRepos: AnalysisTrackingRepo[];
}

export interface AnalysisTrackingProps {
    analyses: AnalysisTrackingAnalysis[];
}

function displayRepository(repo: AnalysisTrackingRepo & { repoAnalysisId: string }) {
    return <li key={repo.repoAnalysisId}>{repo.description}</li>;
}

function listRepositories(repos: AnalysisTrackingRepo[]) {
    return <ul>
        {repos.map((r, i) => displayRepository({ ...r, repoAnalysisId: "" + i }))}
    </ul>;
}

function displayAnalysis(analysis: AnalysisTrackingAnalysis) {
    const analysisStatusClass = analysis.progress === "Going" ? "ongoingAnalysis" : "nongoingAnalysis";
    return <div className={analysisStatusClass}>
        {analysis.description}
        <h4>Repositories:</h4>
        {listRepositories(analysis.plannedRepos)}
    </div>;
}

function listAnalyses(analyses: AnalysisTrackingAnalysis[]) {
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
