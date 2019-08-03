import * as React from "react";
import { PlantedTree, SunburstCircleMetadata } from "../lib/tree/sunburst";

import * as _ from "lodash";

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

export interface SunburstPageProps {
    workspaceId: string;
    fingerprintDisplayName: string;
    currentIdeal: CurrentIdealForDisplay;
    possibleIdeals: PossibleIdealForDisplay[];
    query: string;
    dataUrl: string;
    tree: PlantedTree; // we have the data already.

    /**
     * Tags selected
     */
    selectedTags: string[];

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

function pleaseExclude(tagName: string) {
    return "!" + tagName;
}

function isExclusion(tagName: string) {
    return tagName.startsWith("!");
}

function excludedTagName(tagName: string) {
    return tagName.replace("!", "");
}

function constructTagGroup(selectedTags: string[], t: { name: string, count: number }) {
    const required = selectedTags.includes(t.name);
    const excluded = selectedTags.includes(pleaseExclude(t.name));

    const newTagsWhenTheyClickRequire =
        required ? selectedTags.filter(tt => tt !== t.name).join(",") :
            selectedTags.concat(t.name).join(",");
    const newTagsWhenTheyClickExclude =
        excluded ? selectedTags.filter(tt => tt !== pleaseExclude(t.name)).join(",") :
            selectedTags.concat(pleaseExclude(t.name)).join(",");
    return <div className={"tagGroup " + (required ? "requiredTag " : "") + (excluded ? "excludedTag" : "")}>
        <span className="tagDescription">{t.name} ({t.count})</span>
        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={newTagsWhenTheyClickRequire} />
            <input className="requireButton" type="submit" value="Yes please"></input>
        </form>
        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={newTagsWhenTheyClickExclude} />
            <input className="excludeButton" type="submit" value="Please no" />
        </form>
    </div>;
}

export function SunburstPage(props: SunburstPageProps): React.ReactElement {

    const perLevelDataItems = !props.tree || !props.tree.circles ? []
        : props.tree.circles.map((c, i) => ({ textAreaId: "levelData-" + i, labelText: c.meaning }));

    const d3ScriptCall = `<script>
    const data = ${JSON.stringify(props.tree)};
    SunburstYo.sunburst("${props.workspaceId}",
        data,
        window.innerWidth - 250,
        window.innerHeight - 100,
        [${perLevelDataItems.map(p => `"` + p.textAreaId + `"`).join(",")}]);
    </script>`;

    const thingies: string | React.ReactElement = !props.tree ? "Hover over a slice to see its details" :
        <ul>{perLevelDataItems.map(levelDataListItem)}</ul>;

    const tags: Array<{ name: string, count: number }> = [];
    (_.get(props, "tree.tags", []) as any[]).sort(t => -t.count).forEach(t => tags.push(t));
    props.selectedTags.
        filter(isExclusion).
        map(tn => { tags.push({ name: excludedTagName(tn), count: 0 }); });

    const tagButtons = tags
        .map(t => constructTagGroup(props.selectedTags, t));

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.fingerprintDisplayName}</h1>

        <h2>{props.selectedTags.
            map(t => t.replace("!", "not ")).
            join(" and ") || "All"} - {(props.tree as any).matchingRepoCount} of {(props.tree as any).repoCount} repos</h2>

        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="submit" value="CLEAR" />
        </form>

        {tagButtons}

        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">{thingies}</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={"." + props.dataUrl} type="application/json">Raw data</a>
    </div>;

}
