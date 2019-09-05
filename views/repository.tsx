import * as React from "react";
import { ScoredRepo } from "../lib/aspect/AspectRegistry";
import { isCodeMetricsFingerprint } from "../lib/aspect/common/codeMetrics";
import { WeightedScore } from "../lib/scorer/Score";
import { TagUsage } from "../lib/tree/sunburst";
import { collapsible } from "./utils";

type DisplayName = string;

export interface ProjectFingerprintForDisplay {
    displayName: DisplayName;
    idealDisplayString: string;
    displayValue: string;
    style: React.CSSProperties;
}

export interface ProjectAspectForDisplay {
    aspect: { displayName: DisplayName };
    fingerprints: ProjectFingerprintForDisplay[];
}

export interface RepoExplorerProps {
    repo: ScoredRepo;
    aspects: ProjectAspectForDisplay[];
    category: "*" | string;
    timestamp: Date;
}

export function RepoExplorer(props: RepoExplorerProps): React.ReactElement {
    const categoryDescription = props.category === "*" ? undefined :
        <h3>Scoring by category: <span className="scoreCategoryName">{props.category}</span></h3>;
    const insightsImage = <img src="/hexagonal-fruit-of-power.png" className="insightsImage"></img>;
    return <div>
        <h1>{insightsImage} {props.repo.analysis.id.owner} / <a href={props.repo.analysis.id.url}>{props.repo.analysis.id.repo}</a></h1>
        <p className="analysesProvenanceDetail">Analyzed at: {props.timestamp.toString()}</p>
        <p className="analysesProvenanceDetail">Analyzed commit: {props.repo.analysis.id.sha}</p>

        {categoryDescription}

        {displayWeightedScores(props.repo.weightedScore)}

        {displayTags(props)}

        {displayCodeMetrics(props)}

        {displayAspects(props)}

        {displayRawFingerprints(props)}

        {displayResources(props)}

    </div>;
}

function displayRawFingerprints(props: RepoExplorerProps): React.ReactElement {
    return collapsible("raw-fp", "Raw Fingerprints",
        <pre>
            {JSON.stringify(props.repo.analysis.fingerprints, undefined, 2)}
        </pre>,
        false);

}

function displayResources(props: RepoExplorerProps): React.ReactElement {
    return collapsible("Resources", "Resources",
        <ul>
            <li>Source - <a href={props.repo.analysis.id.url} target="_blank">{props.repo.analysis.id.url}</a></li>
            <li><a href={props.repo.analysis.id.url}>
                URL</a> - {props.repo.analysis.id.url}</li>
        </ul>, true);
}

function displayWeightedScores(weightedScore: WeightedScore): React.ReactElement {
    return collapsible("weightedScores",
        `Score: ${weightedScore.weightedScore.toFixed(2)} / 5`,
        <ul>
            {Object.getOwnPropertyNames(weightedScore.weightedScores).map(name => {
                const score = weightedScore.weightedScores[name];
                return <li><b>{score.name}</b>: {score.score.toFixed(2)} (x{score.weighting}) - {score.reason}</li>;
            })
            }
        </ul>,
        true);
}

function displayAspects(props: RepoExplorerProps): React.ReactElement {
    return collapsible("aspects", `Aspects (${props.aspects.length})`,
        <ul>
            {props.aspects.map(displayAspect)}
        </ul>,
        true);
}

function displayAspect(feature: ProjectAspectForDisplay): React.ReactElement {
    return <li>
        {collapsible("aspects",
            feature.aspect.displayName,
            <ul>
                {feature.fingerprints.map(displayFingerprint)}
            </ul>,
            true)}
    </li>;
}

function displayTags(props: RepoExplorerProps): React.ReactElement {
    return collapsible("tags", "Tags",
        <ul>
            {props.repo.tags.map(displayTag)}
        </ul>,
        true);
}

function displayTag(tag: TagUsage): React.ReactElement {
    return <li><b>{tag.name}</b> - {tag.description}</li>;
}

function displayFingerprint(fingerprint: ProjectFingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {beSureThisIsAString(fingerprint.displayValue)}
        {" "} {fingerprint.idealDisplayString && `(Ideal: ${fingerprint.idealDisplayString})`}
    </li>;
}

function displayCodeMetrics(props: RepoExplorerProps): React.ReactElement {
    const cmf = props.repo.analysis.fingerprints.find(isCodeMetricsFingerprint);
    if (!cmf) {
        return <div />;
    }

    return collapsible("languages", "Languages",
        <ul>
            {cmf.data.languages.map(lang => {
                return <li key={"lang_" + lang}><b>{lang.language.name}</b>: {lang.total}</li>;
            })}
        </ul>,
        true);
}

function beSureThisIsAString(probableString: string): string {
    if (typeof probableString === "string") {
        return probableString;
    }
    return JSON.stringify(probableString);
}
