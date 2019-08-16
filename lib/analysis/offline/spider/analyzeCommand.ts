import { CommandListenerInvocation } from "@atomist/sdm";

export const AnalyzeCommandRegistration = {
    name: "analyzeRepositories", intent: ["analyze"], description: "dig around in repositories and store what we find",
    listener: async (d: CommandListenerInvocation) => {
        d.addressChannels("I AM INVOKED");
    },
};
