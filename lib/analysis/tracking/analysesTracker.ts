import { RepoRef } from "@atomist/automation-client";
import { SpiderResult } from "../offline/spider/Spider";

type AnalysisTrackingRepo = Pick<RepoRef, "owner" | "repo" | "url">;

type AnalysisProgress = "Going" | "Stopped";

interface AnalysisForTracking {
    description: string;
    analysisId: string;
    progress: AnalysisProgress;
}

export interface AnalysisReport {
    analyses: AnalysisForTracking[];
}

export interface AnalysisTracking {
    startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisBeingTracked;
    report(): AnalysisReport;
}

// make the interface later
export class AnalysisBeingTracked {
    constructor(public readonly me: AnalysisForTracking) {
    }
    public plan(repos: AnalysisTrackingRepo[]): void { }

    public stop(result: SpiderResult): void {
        this.me.progress = "Stopped";
    }
}

class AnalysisTracker implements AnalysisTracking {

    private counter: number = 1;
    private analyses: AnalysisBeingTracked[] = [];

    // is there an "unpick" ?
    public startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisBeingTracked {
        const analysisId = "analysis#" + this.counter++;
        const newAnalysis: AnalysisBeingTracked = new AnalysisBeingTracked({
            ...params,
            analysisId,
            progress: "Going",
        });
        this.analyses.push(newAnalysis);
        return newAnalysis;
    }

    public report() {
        return {
            analyses: this.analyses.map(a => a.me),
        };
    }

}

export const globalAnalysisTracking: AnalysisTracking = new AnalysisTracker();
