import { RepoRef } from "@atomist/automation-client";
import { SpiderResult } from "../offline/spider/Spider";

type AnalysisTrackingRepo = string | Pick<RepoRef, "owner" | "repo" | "url">;

type AnalysisProgress = "Going" | "Stopped";

interface AnalysisForTracking {
    description: string;
    analysisId: string;
    progress: AnalysisProgress;
}

interface RepoForReporting {
    description: string;
}
interface AnalysisForReporting {
    description: string;
    analysisId: string;
    progress: AnalysisProgress;
    plannedRepos: RepoForReporting[];
}

export interface AnalysisReport {
    analyses: AnalysisForReporting[];
}

export interface AnalysisTracking {
    startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisBeingTracked;
    report(): AnalysisReport;
}

// make the interface later
export class AnalysisBeingTracked {
    private plannedRepos: AnalysisTrackingRepo[] = [];
    constructor(public readonly me: AnalysisForTracking) {
    }
    public plan(repos: AnalysisTrackingRepo[]): void {
        for (const r of repos) {
            this.plannedRepos.push(r);
        }
    }

    public stop(result: SpiderResult): void {
        this.me.progress = "Stopped";
    }

    public report(): AnalysisForReporting {
        return {
            ...this.me,
            plannedRepos: this.plannedRepos.map(s => {
                if (typeof s === "string") {
                    return { description: s };
                }
                return { description: s.url };
            }),
        };
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
            analyses: this.analyses.map(a => a.report()),
        };
    }

}

export const globalAnalysisTracking: AnalysisTracking = new AnalysisTracker();
