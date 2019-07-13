import { Feature, sha256, TypedFP } from "@atomist/sdm-pack-fingerprints";

export interface LicenseData {
    classification: string;
    content?: string;
}

export const License: Feature<TypedFP<LicenseData>> = {
    name: "license",
    displayName: "License",
    extract: async p => {
        const licenseFile = await p.getFile("LICENSE");
        let classification: string;
        let content: string;
        if (!licenseFile) {
            classification = "None";
        } else {
            content = await licenseFile.getContent();
            classification = content.split("\n")[0].trim();
        }
        const data = { classification, content };
        return {
            type: "license",
            name: "license",
            data,
            sha: sha256(data),
        }
    },
    toDisplayableFingerprintName: () => "License",
    toDisplayableFingerprint: fp => (JSON.parse(fp.data) || {}).classification || "None",
};
