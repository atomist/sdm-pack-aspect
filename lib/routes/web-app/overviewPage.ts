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
import {
    Aspect,
    Ideal,
    idealCoordinates,
    isConcreteIdeal,
    supportsEntropy,
} from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    AspectFingerprintsForDisplay,
    FingerprintForDisplay,
    Overview,
} from "../../../views/overview";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { ConnectionErrorHeading } from "../../analysis/offline/persist/pgClientFactory";
import { FingerprintUsage } from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { defaultedToDisplayableFingerprintName } from "../../aspect/DefaultAspectRegistry";
import { WebAppConfig } from "./webAppConfig";

export function exposeOverviewPage(conf: WebAppConfig,
                                   topLevelRoute: string): void {
    conf.express.get(topLevelRoute, ...conf.handlers, async (req, res) => {
        try {
            const repos = await conf.store.loadInWorkspace(req.query.workspace || req.params.workspace_id, false);
            const workspaceId = "*";
            const fingerprintUsage = await conf.store.fingerprintUsageForType(workspaceId);

            const ideals = await conf.aspectRegistry.idealStore.loadIdeals(workspaceId);

            const aspectsEligibleForDisplay = conf.aspectRegistry.aspects
                .filter(a => !!a.displayName)
                .filter(a => fingerprintUsage.some(fu => fu.type === a.name));
            const foundAspects: AspectFingerprintsForDisplay[] = _.sortBy(aspectsEligibleForDisplay, a => a.displayName)
                .map(aspect => {
                    const fingerprintsForThisAspect = fingerprintUsage.filter(fu => fu.type === aspect.name);
                    return {
                        aspect,
                        fingerprints: fingerprintsForThisAspect
                            .map(fp => formatFingerprintUsageForDisplay(aspect, ideals, fp)),
                    };
                });

            const unfoundAspects: Aspect[] = conf.aspectRegistry.aspects
                .filter(f => !!f.displayName)
                .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));
            const virtualProjectCount = await conf.store.virtualProjectCount(workspaceId);

            res.send(renderStaticReactNode(
                Overview({
                    projectsAnalyzed: repos.length,
                    foundAspects,
                    unfoundAspects,
                    repos: repos.map(r => ({
                        id: r.id,
                        repo: r.repoRef.repo,
                        owner: r.repoRef.owner,
                        url: r.repoRef.url,
                    })),
                    virtualProjectCount,
                }), `Atomist Visualizer (${repos.length} repositories)`,
                conf.instanceMetadata));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send(cleverlyExplainError(conf, e));
        }
    });
}

const ReadmeLink = "https://github.com/atomist/org-visualizer/#database-setup";

function cleverlyExplainError(conf: WebAppConfig, e: Error): string {
    if (e.message.includes(ConnectionErrorHeading) || e.message.includes("ENOCONNECT")) {
        return `This page cannot load without a database connection.<br>
        Please check <a href="${ReadmeLink}">the org-visualizer README</a> for how to set up a database.<p>
        Error:<br>${e.message}`;
    }
    return `Failed to load page. Please check the log output of ${conf.instanceMetadata.name}`;
}

function idealMatchesFingerprint(id: Ideal, fp: FingerprintUsage): boolean {
    const c = idealCoordinates(id);
    return c.type === fp.type && c.name === fp.name;
}

function formatFingerprintUsageForDisplay(aspect: Aspect, ideals: Ideal[], fp: FingerprintUsage): FingerprintForDisplay {
    const foundIdeal = ideals.find(ide => idealMatchesFingerprint(ide, fp));
    const ideal = foundIdeal && isConcreteIdeal(foundIdeal) && aspect.toDisplayableFingerprint ?
        { displayValue: aspect.toDisplayableFingerprint(foundIdeal.ideal) }
        : undefined;
    return {
        ...fp,
        ideal,
        displayName: defaultedToDisplayableFingerprintName(aspect)(fp.name),
        entropy: supportsEntropy(aspect) ? fp.entropy : undefined,
    };
}
