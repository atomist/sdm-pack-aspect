import { Aspect, FP } from "@atomist/sdm-pack-fingerprints";
import { SdmContext, SoftwareDeliveryMachine } from "@atomist/sdm";
import { Build } from "@atomist/sdm-pack-build";

// TODO does this exist
export interface DeliveryGoals {
    build?: Build;
}

// TODO does this exist anywhere
export type FingerprintPublisher = (ctx: SdmContext, fps: FP[]) => Promise<boolean>;


export interface DeliveryAspect<GOALS extends DeliveryGoals, DATA = any> extends Aspect<DATA> {

    register(sdm: SoftwareDeliveryMachine, deliveryGoals: GOALS): void;

}


export function isDeliveryAspect(a: Aspect): a is DeliveryAspect<any> {
    const maybe = a as DeliveryAspect<any>;
    return !!maybe.register;
}