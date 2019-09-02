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

import { Aspect } from "@atomist/sdm-pack-fingerprints";

export interface AspectReportDetails {
    shortName?: string;
    description?: string;
    unit?: string;
    url?: string;
    category?: string;
    manage?: boolean;
}

export interface AspectWithReportDetails<F = any> extends Aspect<F> {
    details?: AspectReportDetails;
}

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
