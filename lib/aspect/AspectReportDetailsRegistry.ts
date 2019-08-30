import { Aspect } from "@atomist/sdm-pack-fingerprints";

export interface AspectReportDetails {
    shortName?: string;
    description?: string;
    unit?: string;
    url?: string;
    category?: string;
    manage?: boolean;
}

export interface AspectWithReportDetails<F = any> extends Aspect<F> {
    details?: AspectReportDetails;
}

/**
 * Manages aspect metadata such as description, short names etc as used by the web-app
 */
export interface AspectReportDetailsRegistry {

    /**
     * Find the known AspectReportDetails for the provided aspect
     */
    reportDetailsOf(type: string | Aspect, workspaceId: string): Promise<AspectReportDetails | undefined>;
}
