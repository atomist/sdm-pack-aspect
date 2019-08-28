import { Aspect } from "@atomist/sdm-pack-fingerprints";
import { Omit } from "../../util/omit";

/**
 * Aspect metadata without extract or consolidate. Used in Aspect consolidation.
 */
export type AspectMetadata<DATA = any> = Omit<Aspect<DATA>, "extract" | "consolidate">;
