/**
 * Return subprojects or undefined if we have no opinion
 */
import { Project } from "@atomist/automation-client";

/**
 * Subproject status
 */
export enum SubprojectStatus {
    /**
     * This is definitely NOT a monorepo
     */
    RootOnly,
    /**
     * This is definitely a monorepo
     */
    IdentifiedPaths,
    /**
     * The monorepo status of this repo cannot be determined
     */
    Unknown,
}

export interface Subprojects {
    status: SubprojectStatus;
    paths? : string[];
}

export type SubprojectFinder = (project: Project) => Promise<Subprojects>;

/**
 * Return a subproject finder of all these
 * @param {SubprojectFinder} finders
 * @return {SubprojectFinder}
 */
export function firstSubprojectFinderOf(...finders: SubprojectFinder[]): SubprojectFinder {
    return async p => {
        for (const finder of finders) {
            const r = await finder(p);
            if (r.status !== SubprojectStatus.Unknown) {
                return r;
            }
        }
        return {
            status: SubprojectStatus.Unknown,
        };
    };
}
