import { RepoRef } from "@atomist/automation-client";

type AnalysisTrackingRepo = Pick<RepoRef, "owner" | "repo" | "url">;

type AnalysisProgress = "Going" | "Stopped";

interface AnalysisForTracking {
    description: string;
    trackedAnalysisId: string;
    progress: AnalysisProgress;
}

export interface AnalysisReport {
    analyses: AnalysisForTracking[];
}

export interface AnalysisTracking {
    plan(repos: AnalysisTrackingRepo[]): void;
    startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisForTracking;
    report(): AnalysisReport;
}

class AnalysisTracker implements AnalysisTracking {

    private counter: number = 1;
    private analyses: AnalysisForTracking[] = [];

    // is there an "unpick" ?
    public startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisForTracking {
        const trackedAnalysisId = "analysis#" + this.counter++;
        const newAnalysis: AnalysisForTracking = {
            ...params,
            trackedAnalysisId,
            progress: "Going",
        };
        this.analyses.push(newAnalysis);
        return newAnalysis;
    }

    public plan(repos: AnalysisTrackingRepo[]) {

    }

    public report() {
        return {
            analyses: this.analyses,
        };
    }

}

export const globalAnalysisTracking: AnalysisTracking = new AnalysisTracker();
