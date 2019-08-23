import * as React from "react";

interface AnalysisTrackingAnalysis {
    description: string;
    analysisId: string;
    progress: "Going" | "Stopped";
}

export interface AnalysisTrackingProps {
    analyses: AnalysisTrackingAnalysis[];
}

function displayAnalysis(analysis: AnalysisTrackingAnalysis) {
    const analysisStatusClass = analysis.progress === "Going" ? "ongoingAnalysis" : "nongoingAnalysis";
    return <div className={analysisStatusClass}>
        {analysis.description}
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
