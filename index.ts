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

export * from "./lib/machine/aspectSupport";
export * from "./lib/machine/configureAspects";
export * from "./lib/aspect/AspectRegistry";
export * from "./lib/aspect/AspectReportDetailsRegistry";
export * from "./lib/aspect/IdealStore";
export * from "./lib/aspect/ProblemStore";
export * from "./lib/tagger/commonTaggers";
export * from "./lib/scorer/Score";
export * from "./lib/scorer/scoring";
export * from "./lib/aspect/common/codeMetrics";
export * from "./lib/aspect/common/codeOwnership";
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
export * from "./lib/aspect/score/ScoredAspect";
export * from "./lib/aspect/common/reviewerAspect";

import * as commonScorers from "./lib/scorer/commonScorers";
import * as commonTaggers from "./lib/tagger/commonTaggers";

export { commonTaggers, commonScorers };
