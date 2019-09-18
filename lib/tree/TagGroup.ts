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

import * as _ from "lodash";
import { TagUsage } from "./sunburst";

/**
 * Class backing displayTagButtons
 */
export class TagGroup {

    private readonly tagsInData: TagUsage[];

    private readonly totalProjectsDisplayed: number;

    constructor(public readonly tagSelection: string[],
                treeWithTags?: { tags?: TagUsage[], matchingRepoCount?: number }) {
        this.tagsInData = treeWithTags && treeWithTags.tags ? treeWithTags.tags : [];
        this.totalProjectsDisplayed = treeWithTags ? treeWithTags.matchingRepoCount : 0;
    }

    public allTagNames(): string[] {
        const tagsFromData = this.tagsInData.map(t => t.name);
        const tagsFromSelection = this.tagSelection.map(this.dontFeelExcluded);
        return _.uniq([...tagsFromSelection, ...tagsFromData]);
    }

    public isRequired(tagName: string): boolean {
        return this.tagSelection.includes(tagName);
    }

    public isExcluded(tagName: string): boolean {
        return this.tagSelection.includes(this.pleaseExclude(tagName));
    }

    public isWarning(tagName: string): boolean {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage && tagUsage.severity === "warn";
    }

    public isError(tagName: string): boolean {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage && tagUsage.severity === "error";
    }

    public getDescription(tagName: string): string | undefined {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage ? tagUsage.description : "";
    }

    /**
     * Return number from 0-100
     * @param {string} tagName
     * @return {number}
     */
    public getPercentageOfProjects(tagName: string): number {
        if (this.isExcluded(tagName)) {
            return 0;
        }
        if (this.isRequired(tagName)) {
            return 100;
        }
        const data = this.tagsInData.find(t => t.name === tagName);
        if (!data) {
            return 0; // whatever
        }
        return Math.round(data.count * 100 / this.totalProjectsDisplayed);
    }

    public describeExclude(tagName: string): string {
        if (this.isRequired(tagName)) {
            return `Switch to excluding ${tagName} projects`;
        }
        if (this.isExcluded(tagName)) {
            return `Currently excluding ${tagName} projects`;
        }
        return `Exclude ${tagName} projects`;
    }

    public describeRequire(tagName: string): string {
        if (this.isRequired(tagName)) {
            return `Currently showing only ${tagName} projects`;
        }
        const dataTag = this.tagsInData.find(t => t.name === tagName);
        if (dataTag) {
            return `Show only ${tagName} projects (${dataTag.count})`;
        }
        return `Show only ${tagName} projects`;
    }

    public tagSelectionForRequire(tagName: string): string[] {
        if (this.isRequired(tagName)) {
            // toggle
            return this.tagSelection.filter(tn => tn !== tagName);
        }
        const existingTagsMinusAnyExclusionOfThisTag = this.tagSelection.filter(tn => tn !== this.pleaseExclude(tagName));
        return [...existingTagsMinusAnyExclusionOfThisTag, tagName];
    }

    public tagSelectionForExclude(tagName: string): string[] {
        if (this.isExcluded(tagName)) {
            // toggle
            return this.tagSelection.filter(tn => tn !== this.pleaseExclude(tagName));
        }
        const existingTagsMinusAnyRequireOfThisTag = this.tagSelection.filter(tn => tn !== tagName);
        return [...existingTagsMinusAnyRequireOfThisTag, this.pleaseExclude(tagName)];

    }

    private pleaseExclude(tagName: string): string {
        return "!" + tagName;
    }

    private dontFeelExcluded(tagName: string): string {
        return tagName.replace("!", "");
    }
}
