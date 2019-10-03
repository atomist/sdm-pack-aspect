/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    logger,
    RepoRef,
} from "@atomist/automation-client";
import { SpiderResult } from "../offline/spider/Spider";
import { VirtualProjectInfo, isVirtualProjectsInfo } from "@atomist/sdm-pack-fingerprint";

interface AnalysisTrackingRepo { description: string; url?: string; }

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
    keptExisting: boolean;
    progress: RepoProgress;
    aspects: AspectForReporting[];
    millisTaken?: number;
    errorMessage?: string;
    stackTrace?: string;
    snapshotId?: string;
    virtualProjectsReport?: { count: number, finderName: string }
}
interface AnalysisForReporting {
    description: string;
    analysisKey: string;
    progress: AnalysisProgress;
    repos: RepoForReporting[];
    error?: Error;
    completedAt?: Date;
}

export interface AnalysisReport {
    analyses: AnalysisForReporting[];
}

export interface AnalysisTracking {
    startAnalysis(params: Pick<AnalysisForTracking, "description">): AnalysisBeingTracked;
    report(): AnalysisReport;
}

export interface FailureDetails {
    whileTryingTo: string; error?: Error; message?: string;
}

type WayToGetFingerprintsFromAnAspect = "extract" | "consolidate";

export interface AspectForReporting {
    aspectName: string;
    visible: boolean;
    stage: WayToGetFingerprintsFromAnAspect;
    millisTaken?: number;
    error?: Error;
    fingerprintsFound: number;
}

/**
 * Track the calculation of fingerprints from one aspect on one repo snapshot
 */
export class AspectBeingTracked {
    public readonly startedAt: Date;
    public completedAt: Date | undefined;
    public fingerprintsFound: number | undefined;
    public failedWith: Error | undefined;
    public moreFailures: Array<{ error: Error, furtherDescription: string }> = [];
    constructor(readonly params: {
        aspectName: string,
        visible: boolean,
        aboutToRun: WayToGetFingerprintsFromAnAspect,
    }) {
        this.startedAt = new Date();
    }

    public isThisYou(aspectName: string): boolean {
        return this.params.aspectName === aspectName;
    }

    public failFingerprint(fp: { type: string, name: string }, error: Error): void {
        this.moreFailures.push({ error, furtherDescription: "Failed on fingerprint: " + fp.name });
    }

    public completed(fingerprintsFound: number): void {
        this.fingerprintsFound = fingerprintsFound;
        this.completedAt = new Date();
    }

    public failed(err: Error): void {
        this.failedWith = err;
        this.completedAt = new Date();
    }

    public report(): AspectForReporting {
        let error = this.failedWith;
        if (!error && this.moreFailures.length === 1) {
            error = this.moreFailures[0].error;
        } else if (error && this.moreFailures.length > 0) {
            const allErrorMessages = (error ? error.message + "\n" : "") +
                this.moreFailures.map(f => f.furtherDescription + ": " + f.error.message).join("\n");
            error = new Error(`multiple errors: ${allErrorMessages}`);
        }
        return {
            aspectName: this.params.aspectName,
            visible: this.params.visible,
            stage: this.params.aboutToRun,
            millisTaken: this.completedAt ? this.completedAt.getTime() - this.startedAt.getTime() : undefined,
            fingerprintsFound: this.fingerprintsFound || 0,
            error,
        };
    }
}

export interface AnalysisTrackingAspect {
    name: string;
    displayName: string | undefined;
}


type AboutVirtualProjects = {
    finderName: string;
    info: VirtualProjectInfo;
};

export class RepoBeingTracked {

    public repoRef: RepoRef | undefined = undefined;
    public millisTaken: number | undefined;
    public existingWasKept: boolean = false;
    public persistedSnapshotId: string | undefined;
    public failureDetails: FailureDetails | undefined = undefined;
    public skipReason: string | undefined;
    public aboutVirtualProjects: AboutVirtualProjects | undefined;
    private analysisStartMillis: number | undefined;

    private readonly aspects: AspectBeingTracked[] = [];

    constructor(private readonly params: {
        description: string;
        url?: string;
        repoKey: string;
    }) {

    }

    public beganAnalysis(): void {
        this.analysisStartMillis = new Date().getTime();
    }

    public foundVirtualProjects(about: AboutVirtualProjects) {
        this.aboutVirtualProjects = about;
    }

    public setRepoRef(repoRef: RepoRef): void {
        this.repoRef = repoRef;
    }

    public keptExisting(): void {
        this.millisTaken = new Date().getTime() - this.analysisStartMillis;
        this.existingWasKept = true;
    }

    public plan(aspect: AnalysisTrackingAspect, aboutToRun: WayToGetFingerprintsFromAnAspect): AspectBeingTracked {
        const newAspect = new AspectBeingTracked({
            aspectName: aspect.name,
            visible: !!aspect.displayName, // this determines whether the aspect will display on the Insights page
            aboutToRun,
        });
        this.aspects.push(newAspect);
        return newAspect;
    }

    public failed(failureDetails: FailureDetails): void {
        this.failureDetails = failureDetails;
        this.millisTaken = this.millisTaken = new Date().getTime() - this.analysisStartMillis;
    }

    public failFingerprint(fp: { type: string, name: string }, error: Error): void {
        const a = this.aspects.find(n => n.isThisYou(fp.type));
        if (!a) {
            logger.warn("Did not find aspect: " + fp.type);
            return;
        }
        a.failFingerprint(fp, error);
    }

    public skipped(skipReason: string): void {
        this.skipReason = skipReason || "unspecified reason";
        this.millisTaken = this.millisTaken = new Date().getTime() - this.analysisStartMillis;
    }

    public persisted(snapshotId: string): void {
        this.persistedSnapshotId = snapshotId;
        this.millisTaken = this.millisTaken = new Date().getTime() - this.analysisStartMillis;
    }

    public report(): RepoForReporting {
        const isGoing = !!this.analysisStartMillis;
        const isDone = this.existingWasKept || this.persistedSnapshotId || this.failureDetails || this.skipReason;
        const errorFields = !this.failureDetails ? {} : {
            errorMessage: `Failed while trying to ${this.failureDetails.whileTryingTo}\n${this.failureDetails.message || ""}`,
            stackTrace: this.failureDetails.error ? this.failureDetails.error.stack : undefined,
        };
        const virtualProjectsReport = this.aboutVirtualProjects && {
            finderName: this.aboutVirtualProjects.finderName,
            count: isVirtualProjectsInfo(this.aboutVirtualProjects.info) ? this.aboutVirtualProjects.info.virtualProjects.length : 0,
        };
        return {
            ...this.params,
            progress: isDone ? "Stopped" : isGoing ? "Going" : "Planned",
            keptExisting: this.existingWasKept,
            millisTaken: this.millisTaken,
            snapshotId: this.persistedSnapshotId,
            aspects: this.aspects.map(a => a.report()),
            virtualProjectsReport,
            ...errorFields,
        };
    }

    public spiderResult(): SpiderResult {
        if (!this.repoRef) {
            throw new Error("Can't return a SpiderResult until repoRef is set");
        }
        return {
            repositoriesDetected: 1,
            failed: this.failureDetails ? [{
                repoUrl: this.repoRef.url,
                whileTryingTo: this.failureDetails.whileTryingTo,
                message: this.failureDetails.error ? this.failureDetails.error.message : this.failureDetails.message,
            }] : [],
            keptExisting: this.existingWasKept ? [this.repoRef.url] : [],
            persistedAnalyses: this.persistedSnapshotId ? [this.repoRef.url] : [],
            millisTaken: this.millisTaken,
        };
    }
}

// make the interface later
export class AnalysisBeingTracked {
    public error?: Error;
    public completedAt: Date | undefined;

    private readonly repos: RepoBeingTracked[] = [];
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

    public stop(): void {
        this.completedAt = new Date();
        this.me.progress = "Stopped";
    }

    public failed(error: Error): void {
        this.error = error;
        this.me.progress = "Stopped";
    }

    public report(): AnalysisForReporting {
        return {
            ...this.me,
            error: this.error,
            repos: this.repos.map(s => s.report()),
            completedAt: this.completedAt,
        };
    }
}

/**
 * Track analyses for display of status on a page.
 * You want exactly one of these in your SDM.
 */
export class AnalysisTracker implements AnalysisTracking {

    private counter: number = 1;
    private readonly analyses: AnalysisBeingTracked[] = [];

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

    public report(): AnalysisReport {
        return {
            analyses: this.analyses.map(a => a.report()),
        };
    }

}
