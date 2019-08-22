export {
    DriftSupportOptions,
    driftSupport,
    DefaultScoreWeightings,
    DefaultVirtualProjectFinder,
} from "./lib/machine/driftSupport";
export {
    CombinationTagger,
    TaggerDefinition,
    RepositoryScorer,
    Tagger,
    AspectRegistry,
    WorkspaceSpecificTagger,
} from "./lib/aspect/AspectRegistry";
export {
    UndesirableUsageCheck,
    UndesirableUsageChecker,
    chainUndesirableUsageCheckers,
} from "./lib/aspect/ProblemStore";

export {
    combinationTaggers,
    CombinationTaggersParams,
    TaggersParams,
} from "./lib/customize/taggers";

export * from "./lib/scorer/Score";
export * from "./lib/scorer/scoring";
export * from "./lib/scorer/scorerUtils";

export * from "./lib/aspect/common/codeMetrics";
export * from "./lib/aspect/common/codeOwnership";
export * from "./lib/aspect/common/stackAspect";
export * from "./lib/aspect/community/codeOfConduct";
export * from "./lib/aspect/community/license";
export * from "./lib/aspect/community/oss";
export * from "./lib/aspect/compose/classificationAspect";
export * from "./lib/aspect/compose/fileMatchAspect";
export * from "./lib/aspect/compose/globAspect";
export * from "./lib/aspect/compose/microgrammarMatchAspect";
export * from "./lib/aspect/git/branchCount";
export * from "./lib/aspect/git/gitActivity";
export * from "./lib/aspect/git/gitIgnore";
export * from "./lib/aspect/git/dateUtils";
export * from "./lib/aspect/secret/exposedSecrets";
