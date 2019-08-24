import { RepoRef } from "@atomist/automation-client";
import { SpiderResult } from "../offline/spider/Spider";

interface AnalysisTrackingRepo { description: string; }

type AnalysisProgress = "Going" | "Stopped";
type RepoProgress = "Planned" | "Going" | "Stopped";

interface AnalysisForTracking {
    description: string;
    analysisKey: string;
    progress: AnalysisProgress;
}

interface RepoForReporting {
    description: string;
    repoKey: string;
    progress: RepoProgress;
}
interface AnalysisForReporting {
    description: string;
    analysisKey: string;
    progress: AnalysisProgress;
    repos: RepoForReporting[];
}

export interface AnalysisReport {
    analyses: AnalysisForReporting[];
}

export interface AnalysisTracking {
    startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisBeingTracked;
    report(): AnalysisReport;
}

export class RepoBeingTracked {

    public existingWasKept: boolean = false;

    constructor(private readonly params: {
        description: string;
        repoKey: string;
    }) {

    }

    public keptExisting(): void {
        this.existingWasKept = true;
    }

    public report(): RepoForReporting {
        return {
            ...this.params,
            progress: this.existingWasKept ? "Stopped" : "Planned",
        };
    }
}

// make the interface later
export class AnalysisBeingTracked {
    private repos: RepoBeingTracked[] = [];
    constructor(public readonly me: AnalysisForTracking) {
    }

    private repoCount: number = 0;

    public plan(repo: AnalysisTrackingRepo): RepoBeingTracked {
        const newRepo = new RepoBeingTracked({
            ...repo,
            repoKey: this.me.analysisKey + "/repo#" + this.repoCount++,
        });
        this.repos.push(newRepo);
        return newRepo;
    }

    public stop(result: SpiderResult): void {
        this.me.progress = "Stopped";
    }

    public report(): AnalysisForReporting {
        return {
            ...this.me,
            repos: this.repos.map(s => s.report()),
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
            analysisKey: analysisId,
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
