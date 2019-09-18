import * as React from "react";

import { describeSelectedTagsToAnimals, TagTree } from "../lib/routes/api";
import { TagGroup } from "../lib/tree/TagGroup";

// tslint:disable-next-line:no-empty-interface
export interface CurrentIdealForDisplay {
    displayValue: string;
}

export interface PossibleIdealForDisplay {
    url?: string;
    fingerprintName: string;
    displayValue: string;
    stringified: string;
}

export type FieldToDisplay = string;

export interface SunburstPageProps {
    readonly workspaceId: string;
    readonly heading: string;
    readonly subheading?: string;
    readonly currentIdeal: CurrentIdealForDisplay;
    readonly possibleIdeals: PossibleIdealForDisplay[];
    readonly query: string;
    readonly dataUrl: string;
    readonly tree: TagTree; // we have the data already.

    /**
     * Tags selected
     */
    readonly selectedTags: string[];

    /**
     * If these fields exist on a node, display them on hover
     */
    fieldsToDisplay: FieldToDisplay[];

}

function displayCurrentIdeal(currentIdeal: CurrentIdealForDisplay): React.ReactElement {
    return <h2>
        Current ideal: {currentIdeal.displayValue}
    </h2>;
}

interface PerLevelDataItem {
    textAreaId: string;
    labelText: string;
}

/* This element will contain the full data value for one level, about the item hovered over. */
function levelDataListItem(item: PerLevelDataItem): React.ReactElement {
    return <li key={"li-" + item.textAreaId}>
        <label htmlFor={item.textAreaId}>{item.labelText}: </label>
        <div className="unfrozenLevelData" id={item.textAreaId}></div>
    </li>;
}

function displayTagGroup(tagGroup: TagGroup): React.ReactElement {
    return <div>
        {tagGroup.tagSelection.length > 0 && <div className="tagGroup">
            clear:
            <form method="GET" action="/explore">
                <input type="hidden" name="explore" value="true" />
                <input className="resetTagSelection" type="submit" value="CLEAR" />
            </form></div>}
        {tagGroup.allTagNames().map(n => displayTagButtons(tagGroup, n))}
    </div>;
}

function displayTagButtons(tagGroup: TagGroup, tagName: string): React.ReactElement {
    const percentageWithTag = tagGroup.getPercentageOfProjects(tagName);
    const percentageBar = <div className="percentageOfProjectWithoutTag">
        <div className="percentageOfProjectsWithTag" style={{ width: percentageWithTag + "%" }}>
            {percentageWithTag}%
        </div>
        {100 - percentageWithTag}%</div>;
    const description = tagGroup.getDescription(tagName) + (tagGroup.isWarning(tagName) ? " - WARN" : "")
        + (tagGroup.isError(tagName) ? " - ERROR" : "");
    return <div className={"tagGroup " +
        (tagGroup.isWarning(tagName) ? "warnTagGroup " : "") +
        (tagGroup.isError(tagName) ? "errorTagGroup " : "") +
        (tagGroup.isRequired(tagName) ? "requiredTag " : "") +
        (tagGroup.isExcluded(tagName) ? "excludedTag" : "")}>
        {percentageBar}
        <img className="taggydoober" src="/taggydoober.png" title={description}></img>
        <span className="tagDescription" title={description}>{tagName}</span>
        <form method="GET" action="/explore">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForRequire(tagName).join(",")} />
            <input className="requireButton" type="submit" value="Yes please"
                title={tagGroup.describeRequire(tagName)}></input>
        </form>
        <form method="GET" action="/explore">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForExclude(tagName).join(",")} />
            <input className="excludeButton" type="submit" value="Please no" alt="alt text"
                title={tagGroup.describeExclude(tagName)} />
        </form>
    </div>;
}

export function SunburstPage(props: SunburstPageProps): React.ReactElement {
    const perLevelDataItems = !props.tree || !props.tree.circles ?
        [] :
        props.tree.circles.map((c, i) => ({ textAreaId: "levelData-" + i, labelText: c.meaning }));

    const d3ScriptCall = `<script>
    const data = ${JSON.stringify(props.tree)};
    SunburstYo.sunburst("${props.workspaceId}",
        data,
        window.innerWidth - 250,
        window.innerHeight - 100,
        { perLevelDataElementIds: [${perLevelDataItems.map(p => `"` + p.textAreaId + `"`).join(",")}],
          fieldsToDisplay: ${JSON.stringify(props.fieldsToDisplay)}
    });
    </script>`;

    const thingies: string | React.ReactElement = !props.tree ? "Hover over a slice to see its details" :
        <ul>{perLevelDataItems.map(levelDataListItem)}</ul>;

    const tagGroup = new TagGroup(props.selectedTags, props.tree);

    const tagButtons = displayTagGroup(tagGroup);

    const h2 = props.subheading ?
        <h2>{props.subheading}</h2> :
        <h2>{describeSelectedTagsToAnimals(props.selectedTags)} - {props.tree.matchingRepoCount} of {props.tree.repoCount} repositories</h2>;

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.heading}</h1>

        {h2}

        {tagButtons}

        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">{thingies}
                <div id="additionalDataAboutWhatYouClicked"></div>
            </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={props.dataUrl} type="application/json">Raw data</a>
    </div>;

}
