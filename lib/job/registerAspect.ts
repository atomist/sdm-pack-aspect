import {
    addressEvent,
    Configuration,
    guid,
    HandlerContext,
} from "@atomist/automation-client";
import { WebSocketLifecycle } from "@atomist/automation-client/lib/internal/transport/websocket/WebSocketLifecycle";
import { AbstractWebSocketMessageClient } from "@atomist/automation-client/lib/internal/transport/websocket/WebSocketMessageClient";
import {
    SoftwareDeliveryMachine,
    StartupListener,
} from "@atomist/sdm";
import { Aspect } from "@atomist/sdm-pack-fingerprint";
import * as cluster from "cluster";
import { hasReportDetails } from "../aspect/AspectReportDetailsRegistry";
import { AspectRegistrations } from "../typings/types";

async function getAspectRegistrations(ctx: Pick<HandlerContext, "graphClient">, name?: string): Promise<AspectRegistrations.AspectRegistration[]> {
    const aspects = (await ctx.graphClient.query<AspectRegistrations.Query, AspectRegistrations.Variables>({
        name: "AspectRegistrations",
        variables: {
            name: !!name ? [name] : undefined,
        },
    }));
    return !!aspects ? aspects.AspectRegistration : [];
}

/**
 * Register aspect report details on start up
 */
export function registerAspects(sdm: SoftwareDeliveryMachine,
                                allAspects: Aspect[]): StartupListener {
    return async () => {
        // Only run this on the cluster master if cluster mode is enabled
        if (sdm.configuration.cluster.enabled && !cluster.isMaster) {
            return;
        }

        const workspaceIds = sdm.configuration.workspaceIds;
        const aspects = allAspects.filter(hasReportDetails);

        for (const workspaceId of workspaceIds) {

            // Set up graphql and message clients
            const messageClient = new TriggeredMessageClient(
                (sdm.configuration.ws as any).lifecycle,
                workspaceId,
                sdm.configuration) as any;
            const graphClient = sdm.configuration.graphql.client.factory.create(workspaceId, sdm.configuration);

            const registeredAspects = await getAspectRegistrations({ graphClient });

            for (const aspect of aspects) {
                const details = aspect.details;
                const registeredAspect = registeredAspects.find(a => a.name === aspect.name && a.owner === sdm.configuration.name);

                const aspectRegistration: AspectRegistrations.AspectRegistration = {
                    name: aspect.name,
                    owner: sdm.configuration.name,
                    displayName: aspect.displayName,
                    unit: details.unit,
                    shortName: details.shortName,
                    description: details.description,
                    category: details.category,
                    url: details.url,
                    enabled: !!registeredAspect ? registeredAspect.enabled : "true",
                };

                await messageClient.send(aspectRegistration, addressEvent("AspectRegistration"));
            }
        }
    };
}

class TriggeredMessageClient extends AbstractWebSocketMessageClient {

    constructor(ws: WebSocketLifecycle,
                workspaceId: string,
                configuration: Configuration) {
        super(ws, {} as any, guid(), { id: workspaceId }, {} as any, configuration);
    }
}
