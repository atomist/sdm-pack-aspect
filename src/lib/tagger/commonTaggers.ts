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

import { logger } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import * as _ from "lodash";
import {
    AspectRegistry,
    Tagger,
    WorkspaceSpecificTagger,
} from "../aspect/AspectRegistry";
import { isCodeMetricsFingerprint } from "../aspect/common/codeMetrics";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import {
    hasNoLicense,
    isLicenseFingerprint,
} from "../aspect/community/license";
import {
    ClassificationData,
    Classifier,
    isClassificationDataFingerprint,
} from "../aspect/compose/classificationAspect";
import { isGlobMatchFingerprint } from "../aspect/compose/globAspect";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import {
    GitActivesType,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { ExposedSecrets } from "../aspect/secret/exposedSecrets";

/**
 * Emit taggers for the given tags from classification fingerprints
 * @param {string} tags
 * @return {Tagger[]}
 */
export function tagsFromClassificationFingerprints(...classifiers: Classifier[]): Tagger[] {
    return _.flatten(classifiers.map(cm => toArray(cm.tags).map(name => ({
        name,
        description: cm.reason,
        test: async repo => repo.analysis.fingerprints.some(fp => isClassificationDataFingerprint(fp)
            && fp.data.tags.includes(name) && fp.data.reasons.includes(cm.reason)),
    }))));
}

/**
 * Tag repositories that contain multiple virtual projects as reported by
 * a VirtualProjectFinder
 */
export const Monorepo: Tagger = {
    name: "monorepo",
    description: "Contains multiple virtual projects",
    severity: "warn",
    test: async repo => repo.analysis.fingerprints.some(fp => !!fp.path && fp.path.length > 0),
};

/**
 * Tag repositories with exposed secrets.
 */
export const Vulnerable: Tagger = {
    name: "vulnerable",
    description: "Has exposed secrets",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === ExposedSecrets.name),
    severity: "error",
};

export const HasLicense: Tagger = {
    name: "license",
    description: "Repositories should have a license",
    test: async repo => repo.analysis.fingerprints.some(fp => isLicenseFingerprint(fp) && !hasNoLicense(fp.data)),
};

export const HasCodeOfConduct: Tagger = {
    name: "code-of-conduct",
    description: "Repositories should have a code of conduct",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === CodeOfConductType),
};

export const HasChangeLog: Tagger = globRequired({
    name: "changelog",
    description: "Repositories should have a changelog",
    glob: "CHANGELOG.md",
});

export const HasContributingFile: Tagger = globRequired({
    name: "contributing",
    description: "Repositories should have a contributing",
    glob: "CONTRIBUTING.md",
});

/**
 * Tag projects as dead if they haven't been committed to recently
 * @param {{days: number}} opts number of days at which to conclude a project is dead
 * @return {Tagger}
 */
export function dead(opts: { deadDays: number }): Tagger {
    return {
        name: "dead?",
        description: `No git activity in last ${opts.deadDays} days`,
        severity: "error",
        test: async repo => repo.analysis.fingerprints.some(fp => {
            if (fp.type === GitRecencyType) {
                const date = new Date(fp.data);
                return daysSince(date) > opts.deadDays;
            }
            return false;
        }),
    };
}

/**
 * Tag repositories that have a single committer, based on GitActives aspect
 */
export const SoleCommitter: Tagger = {
    name: "sole-committer",
    description: "Projects with one committer",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === GitActivesType && fp.data.count === 1),
};

/**
 * Tag repos with an excessive branch count, exceeding a given number of branches
 */
export function excessiveBranchCount(opts: { maxBranches: number }): Tagger {
    return {
        name: `>${opts.maxBranches} branches`,
        description: "git branch count",
        severity: "warn",
        test: async repo => repo.analysis.fingerprints.some(fp => fp.type === BranchCountType && fp.data.count > opts.maxBranches),
    };
}

/**
 * Tag repos whose line count satisfies the given test
 */
export function lineCountTest(opts: { name: string, lineCountTest: (lineCount: number) => boolean }): Tagger {
    return {
        name: opts.name,
        description: "Repo size",
        test: async repo => repo.analysis.fingerprints.some(fp => isCodeMetricsFingerprint(fp) && opts.lineCountTest(fp.data.lines)),
    };
}

export function globRequired(opts: { name: string, description: string, glob: string }): Tagger {
    return {
        ...opts,
        test: async repo => repo.analysis.fingerprints
            .some(fp => isGlobMatchFingerprint(fp) && fp.data.glob === opts.glob && fp.data.matches.length > 0),
    };
}

/**
 * Flag repos with known undesirable usages, according to
 * the relevant UndesirableUsageChecker
 */
export const isProblematic: WorkspaceSpecificTagger = {
    description: "Undesirable usage",
    severity: "error",
    name: "problems",
    createTest: async (workspaceId: string, aspectRegistry: AspectRegistry) => {
        logger.info("Creating problem tagger for workspace %s", workspaceId);
        const checker = await aspectRegistry.undesirableUsageCheckerFor(workspaceId);
        if (checker) {
            return async repo => repo.analysis.fingerprints.some(fp => {
                const problems = checker.check(fp, workspaceId);
                return problems.length > 0;
            });
        }
        return async () => false;
    },
};

/**
 * Tag repos with recent activity by a number of contributors.
 * Depends on git recency and git activity aspects
 */
export function gitHot(opts: { name?: string, hotDays: number, hotContributors: number }): Tagger {
    return {
        name: opts.name || "hot",
        description: "How hot is git",
        test: async repo => {
            const grt = repo.analysis.fingerprints.find(fp => fp.type === GitRecencyType);
            const acc = repo.analysis.fingerprints.find(fp => fp.type === GitActivesType);
            if (!!grt && !!acc) {
                const days = daysSince(new Date(grt.data));
                if (days < opts.hotDays && acc.data.count > opts.hotContributors) {
                    return true;
                }
            }
            return false;
        },
    };
}

/**
 * Tag repos with a missing or inadequate readme, as determined
 * by meeting the given length
 */
export function inadequateReadme(opts: { minLength: number }): Tagger {
    return {
        name: "poor-readme",
        description: "README is adequate",
        severity: "warn",
        test: async repo => repo.analysis.fingerprints.some(fp => isGlobMatchFingerprint(fp) &&
            fp.data.glob === "README.md" && (fp.data.matches.length === 0 || fp.data.matches[0].size < opts.minLength)),
    };
}
