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

import * as _ from "lodash";
import { FingerprintKind } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { AspectRegistry } from "./AspectRegistry";
import {
    AspectReportDetails,
    AspectReportDetailsRegistry,
} from "./AspectReportDetailsRegistry";

export interface ReportDetails extends AspectReportDetails {
    name?: string;
}

export interface AspectReport {
    category: string;
    count: number;
    aspects: ReportDetails[];
}

async function aspectReportDetailsOf(type: string,
                                     workspaceId: string,
                                     details: Record<string, AspectReportDetails>,
                                     aspectRegistry: AspectReportDetailsRegistry): Promise<AspectReportDetails> {
    if (!details[type]) {
        details[type] = await aspectRegistry.reportDetailsOf(type, workspaceId);
    }
    return details[type];
}

export async function getAspectReports(fus: Array<{
                                           owner: string,
                                           repo: string,
                                           fingerprints: Array<FingerprintKind & { details: AspectReportDetails }>,
                                       }>,
                                       aspectRegistry: AspectRegistry & AspectReportDetailsRegistry,
                                       workspaceId: string): Promise<AspectReport[]> {
    const aspects = aspectRegistry.aspects;
    const reports: AspectReport[] = [];
    const categories = [];
    const loadedDetails = {};

    for (const fu of fus) {
        for (const f of fu.fingerprints) {
            const details = await aspectReportDetailsOf(f.type, workspaceId, loadedDetails, aspectRegistry);
            if (!!details) {
                f.details = details;
                categories.push(details.category);
            } else {
                f.details = {};
            }
        }
    }

    _.uniq(categories.filter(c => !!c)).forEach(k => {
        const fu = fus.filter(f => f.fingerprints.map(fp => fp.details.category).includes(k));
        if (fu.length > 0) {
            const allFps = _.uniqBy(
                _.flatten(
                    fu.map(f => f.fingerprints))
                    .filter(fp => fp.details.category === k), "type");
            reports.push({
                category: k,
                count: fu.length,
                aspects: _.uniqBy(allFps.map(f => {
                    const rd = f.details;
                    return {
                        name: (aspectRegistry.aspectOf(f.type) || {} as any).displayName,
                        type: (aspectRegistry.aspectOf(f.type) || {} as any).name,
                        ...rd,
                        url: `/api/v1/${workspaceId}/${rd.url}`,
                    };
                }), "url")
                    .sort((r1, r2) => {
                        const i1 = aspects.findIndex(r => r.name === r1.type);
                        const i2 = aspects.findIndex(r => r.name === r2.type);
                        return i1 - i2;
                    }),
            });
        }
    });

    return reports;

}
