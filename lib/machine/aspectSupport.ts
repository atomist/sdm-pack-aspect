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
    BannerSection,
    Configuration,
    HttpClientFactory,
} from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    ExtensionPack,
    metadata,
    PushImpact,
} from "@atomist/sdm";
import {
    AllGoals,
    isInLocalMode,
} from "@atomist/sdm-core";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    cachingVirtualProjectFinder,
    fileNamesVirtualProjectFinder,
    fingerprintSupport,
    PublishFingerprints,
    VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprints";
import { isDeliveryAspect } from "../../test/aspect/delivery/DeliveryAspect";
import { ClientFactory } from "../analysis/offline/persist/pgUtils";
import {
    analyzeGitHubCommandRegistration,
    analyzeLocalCommandRegistration,
} from "../analysis/offline/spider/analyzeCommand";
import {
    CombinationTagger,
    RepositoryScorer,
    TaggerDefinition,
} from "../aspect/AspectRegistry";
import { DefaultAspectRegistry } from "../aspect/DefaultAspectRegistry";
import { UndesirableUsageChecker } from "../aspect/ProblemStore";
import { api } from "../routes/api";
import { addWebAppRoutes } from "../routes/web-app/webAppRoutes";
import { ScoreWeightings } from "../scorer/Score";
import {
    analysisResultStore,
    createAnalyzer,
    sdmConfigClientFactory,
} from "./machine";

/**
 * Consider directories containing any of these files to be virtual projects
 * @type {VirtualProjectFinder}
 */
export const DefaultVirtualProjectFinder: VirtualProjectFinder =
    cachingVirtualProjectFinder(
        fileNamesVirtualProjectFinder(
            "package.json",
            "pom.xml",
            "build.gradle",
            "requirements.txt",
        ));

export const DefaultScoreWeightings: ScoreWeightings = {
    // Weight this to penalize projects with few other scorers
    anchor: 3,
};

export interface AspectSupportOptions {
    aspects: Aspect | Aspect[];

    virtualProjectFinder?: VirtualProjectFinder;

    scorers?: RepositoryScorer | RepositoryScorer[];
    weightings?: ScoreWeightings;

    taggers?: TaggerDefinition | TaggerDefinition[];
    combinationTaggers?: CombinationTagger | CombinationTagger[];

    undesirableUsageChecker?: UndesirableUsageChecker;

    publishFingerprints?: PublishFingerprints;

    // TODO cd this is hacky
    goals?: Partial<Pick<AllGoals, "build" | "pushImpact">>;
}

export function aspectSupport(options: AspectSupportOptions): ExtensionPack {
    return {
        ...metadata(),
        configure: sdm => {
            const cfg = sdm.configuration;
            if (isInLocalMode()) {
                const analyzer = createAnalyzer(
                    toArray(options.aspects),
                    options.virtualProjectFinder || exports.DefaultVirtualProjectFinder);

                sdm.addCommand(analyzeGitHubCommandRegistration(analyzer));
                sdm.addCommand(analyzeLocalCommandRegistration(analyzer));

                const { customizers, routesToSuggestOnStartup } =
                    orgVisualizationEndpoints(sdmConfigClientFactory(cfg), cfg.http.client.factory, options);

                cfg.http.customizers.push(...customizers);
                routesToSuggestOnStartup.forEach(rtsos => {
                    cfg.logging.banner.contributors.push(suggestRoute(rtsos));
                });
            }
            if (!!options.goals) {

                if (!!options.goals.pushImpact) {
                    sdm.addExtensionPacks(fingerprintSupport({
                        pushImpactGoal: options.goals.pushImpact as PushImpact,
                        aspects: options.aspects,
                        publishFingerprints: options.publishFingerprints,
                    }));
                }

                if (!!options.goals.build) {
                    toArray(options.aspects)
                        .filter(isDeliveryAspect)
                        .forEach(da => da.register(sdm, options.goals, options.publishFingerprints));
                }
            }
        },
    };
}

function suggestRoute({ title, route }: { title: string, route: string }):
    (c: Configuration) => BannerSection {
    return cfg => ({
        title,
        body: `http://localhost:${cfg.http.port}${route}`,
    });
}

function orgVisualizationEndpoints(dbClientFactory: ClientFactory,
                                   httpClientFactory: HttpClientFactory,
                                   options: AspectSupportOptions): {
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    customizers: ExpressCustomizer[],
} {
    const resultStore = analysisResultStore(dbClientFactory);
    const aspectRegistry = new DefaultAspectRegistry({
        idealStore: resultStore,
        problemStore: resultStore,
        aspects: toArray(options.aspects || []),
        undesirableUsageChecker: options.undesirableUsageChecker,
        scorers: toArray(options.scorers || []),
        scoreWeightings: options.weightings || DefaultScoreWeightings,
    })
        .withTaggers(...toArray(options.taggers || []))
        .withCombinationTaggers(...toArray(options.combinationTaggers || []));

    const aboutTheApi = api(resultStore, aspectRegistry);

    if (!isInLocalMode()) {
        return {
            routesToSuggestOnStartup: aboutTheApi.routesToSuggestOnStartup,
            customizers: [aboutTheApi.customizer],
        };
    }

    const aboutStaticPages = addWebAppRoutes(aspectRegistry, resultStore, httpClientFactory);

    return {
        routesToSuggestOnStartup:
            [...aboutStaticPages.routesToSuggestOnStartup,
                ...aboutTheApi.routesToSuggestOnStartup],
        customizers: [aboutStaticPages.customizer, aboutTheApi.customizer],
    };
}
