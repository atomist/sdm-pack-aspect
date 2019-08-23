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

import { AcceptEverythingUndesirableUsageChecker } from "../lib/aspect/ProblemStore";

// Ensure we start up in local mode
process.env.ATOMIST_MODE = "local";

import { Configuration } from "@atomist/automation-client";
import { configure } from "@atomist/sdm-core";
import { LeinDeps } from "@atomist/sdm-pack-clojure/lib/fingerprints/clojure";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    Aspect,
    makeVirtualProjectAware, NpmDeps, VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprints";
import {
    PowerShellLanguage,
    ShellLanguage,
    YamlLanguage,
} from "@atomist/sdm-pack-sloc/lib/languages";
import * as _ from "lodash";
import {
    CombinationTagger,
    RepositoryScorer,
    TaggerDefinition,
} from "../lib/aspect/AspectRegistry";
import { CodeMetricsAspect } from "../lib/aspect/common/codeMetrics";
import { CodeOwnership } from "../lib/aspect/common/codeOwnership";
import { CiAspect } from "../lib/aspect/common/stackAspect";
import {
    CodeOfConduct,
} from "../lib/aspect/community/codeOfConduct";
import {
    License,
    LicensePresence,
} from "../lib/aspect/community/license";
import {
    ChangelogAspect,
    ContributingAspect,
} from "../lib/aspect/community/oss";
import { isFileMatchFingerprint } from "../lib/aspect/compose/fileMatchAspect";
import { globAspect } from "../lib/aspect/compose/globAspect";
import { branchCount } from "../lib/aspect/git/branchCount";
import { GitRecency } from "../lib/aspect/git/gitActivity";
import { ExposedSecrets } from "../lib/aspect/secret/exposedSecrets";
import {
    aspectSupport,
    DefaultVirtualProjectFinder,
} from "../lib/machine/aspectSupport";
import * as commonScorers from "../lib/scorer/commonScorers";
import * as commonTaggers from "../lib/tagger/commonTaggers";

const virtualProjectFinder: VirtualProjectFinder = DefaultVirtualProjectFinder;

/**
 * Sample configuration to enable testing
 * @type {Configuration}
 */
export const configuration: Configuration = configure(async sdm => {
    sdm.addExtensionPacks(
        aspectSupport({
            aspects: aspects(),

            scorers: scorers(),

            taggers: taggers({}),
            combinationTaggers: combinationTaggers({}),

            // Customize this to respond to undesirable usages
            undesirableUsageChecker: AcceptEverythingUndesirableUsageChecker,

            virtualProjectFinder,
        }),
    );
});

function aspects(): Aspect[] {
    return [
        DockerFrom,
        DockerfilePath,
        DockerPorts,
        License,
        // Based on license, decide the presence of a license: Not spread
        LicensePresence,
        new CodeOwnership(),
        NpmDeps,
        CodeOfConduct,
        ExposedSecrets,
        branchCount,
        GitRecency,
        // This is expensive as it requires deeper cloning
        // gitActiveCommitters(30),
        // This is also expensive
        CodeMetricsAspect,
        // StackAspect,
        // CiAspect,
        // JavaBuild,
        // Don't show these
        globAspect({ name: "csproject", displayName: undefined, glob: "*.csproj" }),
        globAspect({ name: "snyk", displayName: undefined, glob: ".snyk" }),
        ChangelogAspect,
        ContributingAspect,
        globAspect({ name: "azure-pipelines", displayName: "Azure pipeline", glob: "azure-pipelines.yml" }),
        globAspect({ name: "readme", displayName: "Readme file", glob: "README.md" }),
        // allMavenDependenciesAspect,    // This is expensive
        LeinDeps,
    ].map(aspect => makeVirtualProjectAware(aspect, virtualProjectFinder));
}

export function scorers(): RepositoryScorer[] {
    return [
        commonScorers.anchorScoreAt(2),
        commonScorers.penalizeForExcessiveBranches({ branchLimit: 5 }),
        commonScorers.PenalizeWarningAndErrorTags,
        commonScorers.PenalizeMonorepos,
        commonScorers.limitLanguages({ limit: 4 }),
        // Adjust depending on the service granularity you want
        commonScorers.limitLinesOfCode({ limit: 30000 }),
        commonScorers.limitLinesOfCodeIn({ language: YamlLanguage, limit: 500, freeAmount: 200 }),
        commonScorers.limitLinesOfCodeIn({ language: PowerShellLanguage, limit: 200, freeAmount: 100 }),
        commonScorers.limitLinesOfCodeIn({ language: ShellLanguage, limit: 200, freeAmount: 100 }),
        commonScorers.requireRecentCommit({ days: 30 }),
        commonScorers.PenalizeNoLicense,
        commonScorers.PenalizeNoCodeOfConduct,
        commonScorers.requireGlobAspect({ glob: "CHANGELOG.md" }),
        commonScorers.requireGlobAspect({ glob: "CONTRIBUTING.md" }),
    ];
}

export interface TaggersParams {

    /**
     * Max number of branches not to call out
     */
    maxBranches: number;

    /**
     * Number of days at which to consider a repo dead
     */
    deadDays: number;
}

export function taggers(opts: Partial<TaggersParams>): TaggerDefinition[] {
    return [
        { name: "docker", description: "Docker status", test: fp => fp.type === DockerFrom.name },
        { name: "clojure", description: "Lein dependencies", test: fp => fp.type === LeinDeps.name },
        {
            name: "jenkins",
            description: "Jenkins",
            test: fp => fp.type === CiAspect.name && fp.data.includes("jenkins"),
        },
        {
            name: "circleci",
            description: "circleci",
            test: fp => fp.type === CiAspect.name && fp.data.includes("circle"),
        },
        {
            name: "azure-pipelines",
            description: "Azure pipelines files",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("azure-pipeline") && fp.data.matches.length > 0,
        },
        {
            // TODO allow to use #
            name: "CSharp",
            description: "C# build",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("csproj") && fp.data.matches.length > 0,
        },
    ];
}

export interface CombinationTaggersParams {

    /**
     * Mininum percentage of average aspect count (fraction) to expect to indicate adequate project understanding
     */
    minAverageAspectCountFractionToExpect: number;

    /**
     * Days since the last commit to indicate a hot repo
     */
    hotDays: number;

    /**
     * Number of committers needed to indicate a hot repo
     */
    hotContributors: number;
}

const DefaultCombinationTaggersParams: CombinationTaggersParams = {
    minAverageAspectCountFractionToExpect: .75,
    hotDays: 2,
    hotContributors: 3,
};

export function combinationTaggers(opts: Partial<CombinationTaggersParams>): CombinationTagger[] {
    const optsToUse = {
        ...DefaultCombinationTaggersParams,
        ...opts,
    };
    return [
        {
            name: "not understood",
            description: "You may want to write aspects for these outlier projects",
            severity: "warn",
            test: (fps, id, tagContext) => {
                const aspectCount = _.uniq(fps.map(f => f.type)).length;
                // There are quite a few aspects that are found on everything, e.g. git
                // We need to set the threshold count probably
                return aspectCount < tagContext.averageFingerprintCount * optsToUse.minAverageAspectCountFractionToExpect;
            },
        },
        commonTaggers.gitHot(optsToUse),
    ];
}
