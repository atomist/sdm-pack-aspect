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
import { isInLocalMode } from "@atomist/sdm-core";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    cachingVirtualProjectFinder,
    fileNamesVirtualProjectFinder,
    fingerprintSupport,
    RegisterFingerprintImpactHandler,
    VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprints";
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

export const DefaultVirtualProjectFinder: VirtualProjectFinder = cachingVirtualProjectFinder(
    fileNamesVirtualProjectFinder(
        "package.json", "pom.xml", "build.gradle", "requirements.txt",
    ));

export const DefaultScoreWeightings: ScoreWeightings = {
    // Weight this to penalize projects with few other scorers
    anchor: 3,
};

export interface DriftSupportOptions {
    aspects: Aspect | Aspect[];
    pushImpactGoal?: PushImpact;
    impactHandlers?: RegisterFingerprintImpactHandler | RegisterFingerprintImpactHandler[];

    virtualProjectFinder?: VirtualProjectFinder;

    scorers?: RepositoryScorer | RepositoryScorer[];
    weightings?: ScoreWeightings;

    taggers?: TaggerDefinition | TaggerDefinition[];
    combinationTaggers?: CombinationTagger | CombinationTagger[];

    undesirableUsageChecker?: UndesirableUsageChecker;
}

export function driftSupport(options: DriftSupportOptions): ExtensionPack {
    return {
        ...metadata(),
        configure: sdm => {

            const cfg = sdm.configuration;

            if (isInLocalMode()) {
                const analyzer = createAnalyzer(toArray(options.aspects), options.virtualProjectFinder || DefaultVirtualProjectFinder);
                sdm.addCommand(analyzeGitHubCommandRegistration(analyzer));
                sdm.addCommand(analyzeLocalCommandRegistration(analyzer));

                const { customizers, routesToSuggestOnStartup } =
                    orgVisualizationEndpoints(
                        sdmConfigClientFactory(cfg),
                        cfg.http.client.factory,
                        options,
                    );
                cfg.http.customizers.push(...customizers);
                routesToSuggestOnStartup.forEach(rtsos => {
                    cfg.logging.banner.contributors.push(suggestRoute(rtsos));
                });
            } else {
                if (!!options.pushImpactGoal) {
                    sdm.addExtensionPacks(
                        fingerprintSupport({
                            pushImpactGoal: options.pushImpactGoal,
                            aspects: options.aspects,
                            handlers: options.impactHandlers || [],
                        }));
                }
            }

            // start up embedded postgres if needed
            /*if (process.env.ATOMIST_POSTGRES === "start" && !_.get(cfg, "sdm.postgres")) {
                logger.debug("Starting embedded Postgres");
                await execPromise("/etc/init.d/postgresql", ["start"]);

                const postgresCfg = {
                    user: "org_viz",
                    password: "atomist",
                };
                _.set(cfg, "sdm.postgres", postgresCfg);
                await writeUserConfig({
                    sdm: {
                        postgres: postgresCfg,
                    },
                });
            }*/
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
                                   options: DriftSupportOptions): {
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    customizers: ExpressCustomizer[],
} {
    const resultStore = analysisResultStore(dbClientFactory);
    const aspectRegistry = new DefaultAspectRegistry({
        idealStore: resultStore,
        problemStore: resultStore,
        aspects: toArray(options.aspects),
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
