import { Feature } from "@atomist/sdm-pack-fingerprints";

export interface DocumentedFeature {
    documentationUrl: string;
}

export function isDocumentedFeature(f: Feature): f is Feature & DocumentedFeature {
    const maybe = f as any as DocumentedFeature;
    return !!maybe.documentationUrl;
}
