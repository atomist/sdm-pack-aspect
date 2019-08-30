import {
    clientLoggingConfiguration,
    Configuration,
    configureLogging,
} from "@atomist/automation-client";
import { loadConfiguration } from "@atomist/automation-client/lib/configuration";
import {
    GitHubLazyProjectLoader,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import * as path from "path";

export async function configure(cfg: Configuration): Promise<SoftwareDeliveryMachineConfiguration> {
    const configuration = await loadConfiguration() as SoftwareDeliveryMachineConfiguration;
    const mergedConfiguration = {
        ...configuration,
        ...cfg,
        logging: {
            level: "debug" as any,
        },
    };
    mergedConfiguration.sdm.projectLoader = new GitHubLazyProjectLoader(mergedConfiguration.sdm.projectLoader);
    configureLogging(clientLoggingConfiguration(mergedConfiguration));
    return mergedConfiguration;
}
