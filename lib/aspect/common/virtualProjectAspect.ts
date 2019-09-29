import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprint";
import { Project, ProjectFile } from "@atomist/automation-client";

import * as _ from "lodash";

import * as pathlib from "path";
import { isFile } from "@atomist/automation-client/lib/project/File";

export interface VirtualProjectData {

    readonly reason: string;

    /**
     * Virtual project paths within this project
     */
    readonly path: string;
}

export interface VirtualProjectFinding {

    readonly reason: string;

    /**
     * Virtual project paths within this project
     */
    readonly paths: string[];
}

export const VirtualProjectType = "virtual-projects";

// TODO move to aspect pack
export function virtualProjectAspect(
    ...finders: Array<(p: Project) => Promise<VirtualProjectFinding>>): Aspect<VirtualProjectData> {
    return {
        name: VirtualProjectType,
        displayName: undefined,
        extract: async p => {
            const findings = await Promise.all(finders.map(finder => finder(p)));
            return _.flatten(findings.map(finding =>
                finding.paths.map(path => fingerprintOf({
                        type: VirtualProjectType,
                        data: { reason: finding.reason, path },
                        path,
                    })
                )));
        },
    };
}

/**
 * Convenient function to extract directory name from the file
 * @param {File} f
 * @return {string}
 */
export function dirName(f: ProjectFile | string): string {
    return pathlib.dirname(isFile(f) ? f.path : f);
}
