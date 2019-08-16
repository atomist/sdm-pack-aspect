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

export interface AnalyzeCommandParameters {
    source: "GitHub" | "local";
}

const AnalyzeCommandParametersDefinition: ParametersObject<AnalyzeCommandParameters> = {
    source: {
        description: "find repositories on GitHub or local filesystem",
        defaultValue: "GitHub",
        type: {
            kind: "single",
            options: [
                { description: "find repositories on GitHub by owner or query", value: "GitHub" },
                { description: "find repositories on the local filesystem", value: "local" }],
        },
        pattern: /GitHub|local/,
        validInput: "'GitHub' or 'local'",
    },
};

export const AnalyzeCommandRegistration: CommandHandlerRegistration<AnalyzeCommandParameters> = {
    name: "analyzeRepositories",
    intent: ["analyze"],
    description: "dig around in repositories and store what we find",
    parameters: AnalyzeCommandParametersDefinition,
    listener: async (d: CommandListenerInvocation<AnalyzeCommandParameters>) => {
        d.addressChannels("I AM INVOKED with " + d.parameters.source);
    },
};
