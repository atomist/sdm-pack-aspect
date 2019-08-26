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
    CommandHandlerRegistration,
    CommandListener,
    ParametersObject,
} from "@atomist/sdm";
import { Analyzer } from "./Spider";
import {
    spider,
    SpiderAppOptions,
} from "./spiderCall";

interface AnalyzeCommandParameters {
    workspaceId: string;
    update: boolean;
}

const AnalyzeCommandParameterDefinitions: ParametersObject<AnalyzeCommandParameters> = {
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
};

export interface AnalyzeGitHubCommandParameters extends AnalyzeCommandParameters {
    source: "GitHub";
    search?: string;
    cloneUnder?: string;
}
export interface AnalyzeGitHubOrganizationCommandParameters extends AnalyzeGitHubCommandParameters {
    owner?: string;
}
export interface AnalyzeGitHubByQueryCommandParameters extends AnalyzeGitHubCommandParameters {
    query?: string;
}

const AnalyzeGitHubCommandParametersDefinition: ParametersObject<AnalyzeGitHubCommandParameters> = {
    ...AnalyzeCommandParameterDefinitions,
    source: {
        description: "find repositories on GitHub, by organization or query",
        defaultValue: "GitHub",
        displayable: false,
        required: false,
        pattern: /GitHub/,
        validInput: "'GitHub'",
    },
    search: {
        description: "To narrow which repositories within an owner, provide a substring to look for in the repo name",
        required: false,
    },
    cloneUnder: {
        description: "A local directory to clone repositories in",
        required: false,
    },
};

const AnalyzeGitHubOrganizationCommandParametersDefinition: ParametersObject<AnalyzeGitHubOrganizationCommandParameters> = {
    ...AnalyzeGitHubCommandParametersDefinition,
    owner: {
        description: "GitHub owner of repositories to analyze",
        required: true,
    },
};

const AnalyzeGitHubByQueryCommandParametersDefinition: ParametersObject<AnalyzeGitHubByQueryCommandParameters> = {
    ...AnalyzeGitHubCommandParametersDefinition,
    query: {
        description: "A GitHub search query to choose repositories",
        required: true,
    },
};
export interface AnalyzeLocalCommandParameters extends AnalyzeCommandParameters {
    update: boolean;
    source: "local";
    localDirectory: string;
}

const AnalyzeLocalCommandParametersDefinition: ParametersObject<AnalyzeLocalCommandParameters> = {
    ...AnalyzeCommandParameterDefinitions,
    source: {
        description: "find repositories on the local filesystem",
        defaultValue: "local",
        displayable: false,
        required: false,
        pattern: /local/,
        validInput: "'local'",
    },
    localDirectory: {
        description: "absolute path to find repositories in",
        required: true,
    },
};

function analyzeFromGitHubOrganization(analyzer: Analyzer): CommandListener<AnalyzeGitHubOrganizationCommandParameters> {
    return async d => {
        const spiderAppOptions: SpiderAppOptions = d.parameters;
        logger.info("analyze github org invoked with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions, analyzer);
        await d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };
}

function analyzeFromGitHubByQuery(analyzer: Analyzer): CommandListener<AnalyzeGitHubByQueryCommandParameters> {
    return async d => {
        const spiderAppOptions: SpiderAppOptions = d.parameters;
        logger.info("analyze github by query invoked with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions, analyzer);
        await d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };
}

export function analyzeGitHubOrganizationCommandRegistration(analyzer: Analyzer): CommandHandlerRegistration<AnalyzeGitHubCommandParameters> {
    return {
        name: "analyzeRepositoriesFromGitHubOrganization",
        intent: ["analyze github organization"],
        description: "analyze repositories from one GitHub organization (or user)",
        parameters: AnalyzeGitHubOrganizationCommandParametersDefinition,
        listener: analyzeFromGitHubOrganization(analyzer),
    };
}

export function analyzeGitHubByQueryCommandRegistration(analyzer: Analyzer): CommandHandlerRegistration<AnalyzeGitHubCommandParameters> {
    return {
        name: "analyzeRepositoriesFromGitHubByQuery",
        intent: ["analyze github by query"],
        description: "choose repositories to analyze by GitHub query",
        parameters: AnalyzeGitHubByQueryCommandParametersDefinition,
        listener: analyzeFromGitHubByQuery(analyzer),
    };
}

import * as path from "path";

function analyzeFromLocal(analyzer: Analyzer): CommandListener<AnalyzeLocalCommandParameters> {
    return async d => {
        if (!path.isAbsolute(d.parameters.localDirectory)) {
            await d.addressChannels("Please provide an absolute path. You provided: " + d.parameters.localDirectory);
            return { code: 1, error: new Error("Please provide an absolute path") };
        }

        const spiderAppOptions: SpiderAppOptions = d.parameters;
        logger.info("analyze local invoked with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions, analyzer);
        await d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };
}

export function analyzeLocalCommandRegistration(analyzer: Analyzer): CommandHandlerRegistration<AnalyzeLocalCommandParameters> {
    return {
        name: "analyzeRepositoriesFromLocalFilesystem",
        intent: ["analyze local repositories"],
        description: "choose repositories to analyze, by parent directory",
        parameters: AnalyzeLocalCommandParametersDefinition,
        listener: analyzeFromLocal(analyzer),
    };
}
