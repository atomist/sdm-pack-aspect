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
