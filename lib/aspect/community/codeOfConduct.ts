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

import { Aspect, fingerprintOf, } from "@atomist/sdm-pack-fingerprints";
import { ContentClassifier } from "./ContentClassifier";

export const CodeOfConductType = "code-of-conduct";

export interface CodeOfConductData {

    /**
     * Title inferred from the code of conduct, if it was possible to do so
     */
    title?: string;
}

/**
 * Find a code of conduct in a repository if possible.
 * Returns no fingerprint if the repository lacks a code of conduct file.
 * @constructor
 */
export function codeOfConduct(opts: { classifier: ContentClassifier } =
                                  { classifier: extractTitle }): Aspect<CodeOfConductData> {
    return {
        name: CodeOfConductType,
        displayName: "Code of conduct",
        baseOnly: true,
        extract: async p => {
            const codeOfConductFile = await p.getFile("CODE_OF_CONDUCT.md");
            if (codeOfConductFile) {
                const content = await codeOfConductFile.getContent();
                const data = {
                    title: extractTitle(content),
                    content,
                };
                return fingerprintOf({
                    type: CodeOfConductType,
                    data,
                });
            }
            return undefined;
        },
        toDisplayableFingerprintName: () => "Code of conduct",
        toDisplayableFingerprint: fpi => {
            return fpi.data.title || "untitled";
        },
    };
}

const markdownTitleRegex = /^# (.*)\n/;

/**
 * Try to extract the title from this markdown document
 * @param {string} mdString
 * @return {string | undefined}
 */
function extractTitle(mdString: string): string | undefined {
    const match = markdownTitleRegex.exec(mdString);
    return (match && match.length === 2) ?
        match[1] :
        undefined;
}
