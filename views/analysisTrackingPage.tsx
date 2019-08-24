import * as React from "react";

interface AnalysisTrackingRepo {
    description: string;
    progress: "Planned" | "Going" | "Stopped";
    keptExisting: boolean;
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

function displayRepository(repo: AnalysisTrackingRepo & { repoAnalysisId: string }) {
    const className = repo.keptExisting ? "keptExistingAnalysis" : undefined;
    return <li key={repo.repoAnalysisId} className={className}>{repo.description}</li>;
}

function listRepositories(title: string, repos: AnalysisTrackingRepo[]) {
    return <div>{title}<ul>
        {repos.map((r, i) => displayRepository({ ...r, repoAnalysisId: "" + i }))}
    </ul></div>;
}

function displayAnalysis(analysis: AnalysisTrackingAnalysis) {
    const analysisStatusClass = analysis.progress === "Going" ? "ongoingAnalysis" : "nongoingAnalysis";
    return <div className={analysisStatusClass}>
        {analysis.description}
        <h4>Repositories:</h4>
        <div className="repositoryColumns">
            {listRepositories("Planned", analysis.repos.filter(r => r.progress === "Planned"))}
            {listRepositories("Stopped", analysis.repos.filter(r => r.progress === "Stopped"))}
        </div>
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
