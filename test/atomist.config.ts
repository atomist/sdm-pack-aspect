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

import { Configuration } from "@atomist/automation-client";
import { loadUserConfiguration } from "@atomist/automation-client/lib/configuration";
import {
    anySatisfied,
    PushImpact,
} from "@atomist/sdm";
import {
    configure,
    DeliveryGoals,
} from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    Aspect,
    NpmDeps,
    VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprint";
import {
    PowerShellLanguage,
    ShellLanguage,
    YamlLanguage,
} from "@atomist/sdm-pack-sloc/lib/languages";
import {
    IsMaven,
    mavenBuilder,
    MavenDefaultOptions,
} from "@atomist/sdm-pack-spring";
import { sdmConfigClientFactory } from "../lib/analysis/offline/persist/pgClientFactory";
import { PostgresProjectAnalysisResultStore } from "../lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import {
    RepositoryScorer,
    Tagger,
    TaggerDefinition,
} from "../lib/aspect/AspectRegistry";
import { enrich } from "../lib/aspect/AspectReportDetailsRegistry";
import { CodeMetricsAspect } from "../lib/aspect/common/codeMetrics";
import { codeOwnership } from "../lib/aspect/common/codeOwnership";
import { codeOfConduct } from "../lib/aspect/community/codeOfConduct";
import {
    license,
    LicensePresence,
} from "../lib/aspect/community/license";
import {
    ChangelogAspect,
    ContributingAspect,
} from "../lib/aspect/community/oss";
import { projectClassificationAspect } from "../lib/aspect/compose/classificationAspect";
import { isFileMatchFingerprint } from "../lib/aspect/compose/fileMatchAspect";
import { globAspect } from "../lib/aspect/compose/globAspect";
import { buildTimeAspect } from "../lib/aspect/delivery/BuildAspect";
import { storeFingerprints } from "../lib/aspect/delivery/storeFingerprintsPublisher";
import { BranchCount } from "../lib/aspect/git/branchCount";
import { GitRecency } from "../lib/aspect/git/gitActivity";
import {
    AcceptEverythingUndesirableUsageChecker,
    chainUndesirableUsageCheckers,
    UndesirableUsageChecker,
} from "../lib/aspect/ProblemStore";
import { ExposedSecrets } from "../lib/aspect/secret/exposedSecrets";
import {
    aspectSupport,
    DefaultVirtualProjectFinder,
} from "../lib/machine/aspectSupport";
import {
    AverageRepoScore,
    EntropyScore,
    WorstRepoScore,
} from "../lib/scorer/commonWorkspaceScorers";
import * as commonScorers from "../lib/scorer/commonScorers";
import { FiveStar } from "../lib/scorer/Score";
import * as commonTaggers from "../lib/tagger/commonTaggers";

// Ensure we start up in local mode
process.env.ATOMIST_MODE = "local";

// Ensure we use this workspace so we can see all fingerprints with the local UI
process.env.ATOMIST_WORKSPACES = "local";

const virtualProjectFinder: VirtualProjectFinder = DefaultVirtualProjectFinder;

const store = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory(loadUserConfiguration()));

interface TestGoals extends DeliveryGoals {
    build: Build;
}

const undesirableUsageChecker: UndesirableUsageChecker = chainUndesirableUsageCheckers(
    fingerprint => fingerprint.type === NpmDeps.name && fingerprint.name === "axios" ?
        {
            severity: "warn",
            authority: "Christian",
            description: "Don't use Axios",
            fingerprint,
        } :
        undefined,
);

/**
 * Sample configuration to enable testing
 * @type {Configuration}
 */
export const configuration: Configuration = configure<TestGoals>(async sdm => {

    const goals = await sdm.createGoals(async () => {
        const build: Build = new Build()
            .with({
                ...MavenDefaultOptions,
                builder: mavenBuilder(),
            });

        const pushImpact = new PushImpact();

        return {
            // This illustrates a delivery goal
            build,

            // This illustrates pushImpact
            pushImpact,
        };
    }, []);

    sdm.addExtensionPacks(
        aspectSupport({
            aspects: aspects(),

            goals,

            scorers: {
                all: scorers(),
            },

            workspaceScorers: [
                AverageRepoScore,
                WorstRepoScore,
                EntropyScore,
            ],

            weightings: {
                worst: 1,
                average: 3,
                entropy: 3,
            },

            // inMemoryScorers: commonScorers.exposeFingerprintScore("all"),

            // taggers: taggers({}).concat(combinationTaggers({})),

            inMemoryTaggers: taggers({}),

            // Customize this to respond to undesirable usages
            undesirableUsageChecker,

            publishFingerprints: storeFingerprints(store),
            virtualProjectFinder,

            exposeWeb: true,
            secureWeb: false,
        }),
    );

    return {
        fingerprint: {
            goals: goals.pushImpact,
        },
        build: {
            test: anySatisfied(IsMaven /*, IsNode */),
            goals: goals.build,
        },
    };

});

function aspects(): Aspect[] {
    return [
        enrich(DockerFrom, {
            shortName: "images",
            category: "Docker",
            unit: "tag",
            url: "fingerprint/docker-base-image/*?byOrg=true&trim=false",
            description: "Docker base images in use across all repositories in your workspace, " +
            "broken out by image label and repositories where used.",
        }),
        DockerfilePath,
        enrich(DockerPorts, {
            shortName: "ports",
            category: "Docker",
            unit: "port",
            url: "fingerprint/docker-ports/docker-ports?byOrg=true&trim=false",
            description: "Ports exposed in Docker configuration in use  across all repositories in your workspace, " +
            "broken out by port number and repositories where used.",
            manage: false,
        }),
        license(),
        // Based on license, decide the presence of a license: Not spread
        LicensePresence,
        codeOwnership(),
        NpmDeps,
        codeOfConduct(),
        ExposedSecrets,
        enrich(BranchCount, {
            shortName: "branches",
            category: "Git",
            unit: "branch",
            url: `fingerprint/${BranchCount.name}/${BranchCount.name}?byOrg=true&trim=false`,
            description: "Number of Git branches across repositories in your workspace, " +
            "grouped by Drift Level.",
            manage: false,
        }),
        GitRecency,
        // This is expensive as it requires deeper cloning
        // gitActiveCommitters(30),
        // This is also expensive
        CodeMetricsAspect,
        // Don't show these: set displayName to undefined
        globAspect({ name: "csproject", displayName: undefined, glob: "*.csproj" }),
        globAspect({ name: "snyk", displayName: undefined, glob: ".snyk" }),
        ChangelogAspect,
        ContributingAspect,
        globAspect({ name: "azure-pipelines", displayName: "Azure pipeline", glob: "azure-pipelines.yml" }),
        globAspect({ name: "readme", displayName: "Readme file", glob: "README.md" }),

        projectClassificationAspect({
                name: "javaBuild",
                displayName: "Java build tool",
                toDisplayableFingerprintName: () => "Java build tool",
            },
            { tags: "maven", reason: "has Maven POM", test: async p => p.hasFile("pom.xml") },
            { tags: "gradle", reason: "has build.gradle", test: async p => p.hasFile("build.gradle") },
        ),

        // allMavenDependenciesAspect,    // This is expensive

        buildTimeAspect(),
    ];
}

export function scorers(): RepositoryScorer[] {
    return [
        commonScorers.anchorScoreAt(2),
        commonScorers.penalizeForExcessiveBranches({ branchLimit: 5 }),
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
        {
            name: "docker", description: "Docker status",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === DockerFrom.name),
        },
        {
            name: "azure-pipelines",
            description: "Azure pipelines files",
            test: async repo => repo.analysis.fingerprints.some(fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("azure-pipeline") && fp.data.matches.length > 0),
        },
        {
            // TODO allow to use #
            name: "CSharp",
            description: "C# build",
            test: async repo => repo.analysis.fingerprints.some(fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("csproj") && fp.data.matches.length > 0),
        },
        {
            name: "bad",
            description: "Has problems",
            createTest: async (wsid, ar) => {
                const uc = await ar.undesirableUsageCheckerFor(wsid);
                return async repo => repo.analysis.fingerprints.some(fp => uc.check(fp, wsid).length > 0);
            },
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

export function combinationTaggers(opts: Partial<CombinationTaggersParams>): Tagger[] {
    const optsToUse = {
        ...DefaultCombinationTaggersParams,
        ...opts,
    };
    return [
        commonTaggers.gitHot(optsToUse),
    ];
}
