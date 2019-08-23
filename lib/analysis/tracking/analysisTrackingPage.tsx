import * as React from "react";

interface AnalysisTrackingAnalysis {
    description: string;
    analysisId: string;
}

export interface AnalysisTrackingProps {
    analyses: AnalysisTrackingAnalysis[];
}

function displayAnalysis(analysis: AnalysisTrackingAnalysis) {
    return <li key={analysis.analysisId}>
        analysis.description
    </li>;
}

function listAnalyses(analyses: AnalysisTrackingAnalysis[]) {
    return <ul>${analyses.map(displayAnalysis)}</ul>;
}

export function AnalysisTrackingPage(props: AnalysisTrackingProps): React.ReactElement {
    if (props.analyses.length === 0) {
        return <div>No analyses in progress.
            Start one at the command line:{" "}
            <span className="typeThisAtCommandLine">atomist analyze local repositories</span></div>;
    }
    return <div>{listAnalyses(props.analyses)}</div>;
}
