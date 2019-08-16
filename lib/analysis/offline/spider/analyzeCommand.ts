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
    CommandHandlerRegistration,
    CommandListenerInvocation,
    ParametersObject,
} from "@atomist/sdm";
import { spider, SpiderAppOptions } from "./spiderCall";

export interface AnalyzeCommandParameters {
    workspaceId: string;
    update: boolean;
    source: "GitHub" | "local";
    owner?: string;
    query?: string;
    search?: string;
    cloneUnder?: string;
}

const AnalyzeCommandParametersDefinition: ParametersObject<AnalyzeCommandParameters> = {
    workspaceId: {
        description: "Atomist workspace ID to save analysis in. Defaults to 'local'",
        defaultValue: "local",
        required: false,
    },
    update: {
        type: "boolean",
        description: "Overwrite existing analyses? (default is no)",
        required: false,
    },
    source: {
        description: "find repositories on GitHub. Please specify at least 'owner' or 'query'",
        defaultValue: "GitHub",
        displayable: false,
        required: false,
        pattern: /GitHub/,
        validInput: "'GitHub'",
    },
    owner: {
        description: "GitHub owner of repositories to analyze",
        required: true,
    },
    query: {
        description: "A GitHub search query to choose repositories",
        required: true,
    },
    search: {
        description: "To narrow which repositories, provide a substring to look for in the repo name",
        required: true,
    },
    cloneUnder: {
        description: "A local directory to clone repositories in",
        required: false,
    },
};

const analyzeFromGitHub =
    async (d: CommandListenerInvocation<AnalyzeCommandParameters>) => {
        const { owner, query } = d.parameters;
        if (!owner && !query) {
            d.addressChannels("Please provide either 'owner' or 'query'");
            return { code: 1 };
        }
        const spiderAppOptions: SpiderAppOptions = d.parameters;
        d.addressChannels("I AM INVOKED with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions);
        d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };

export const AnalyzeGitHubCommandRegistration: CommandHandlerRegistration<AnalyzeCommandParameters> = {
    name: "analyzeRepositoriesFromGitHub",
    intent: ["analyze github repositories"],
    description: "choose repositories to analyze, by owner or query",
    parameters: AnalyzeCommandParametersDefinition,
    listener: analyzeFromGitHub,
};
