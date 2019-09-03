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

import { Aspect } from "@atomist/sdm-pack-fingerprint";

/**
 * Details needed for the web-app to show the aspects
 */
export interface AspectReportDetails {
    /** Short name of the aspect as used in headlines etc */
    shortName?: string;
    /** Longish description of the aspect */
    description?: string;
    /** What is the aspect measuring: a version, a docker image tag */
    unit?: string;
    /** The url to the sunburst data to use when rendering the chart on the web-app */
    url?: string;
    /** Category to place the aspect in */
    category?: string;
    /** Does this aspect support setting targets etc */
    manage?: boolean;
}

/**
 * Extension to core Aspect to have additional metadata
 */
export interface AspectWithReportDetails<F = any> extends Aspect<F> {
    details?: AspectReportDetails;
}

/**
 * Add report details to the provided Aspect
 */
export function enrich(aspect: Aspect, details: AspectReportDetails): AspectWithReportDetails {
    return {
        ...aspect,
        details,
    };
}

/**
 * Manages aspect metadata such as description, short names etc as used by the web-app
 */
export interface AspectReportDetailsRegistry {

    /**
     * Find the known AspectReportDetails for the provided aspect
     */
    reportDetailsOf(type: string | Aspect, workspaceId: string): Promise<AspectReportDetails | undefined>;
}
