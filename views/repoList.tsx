import * as _ from "lodash";
import * as React from "react";
import { SortOrder } from "../lib/routes/web-app/repositoryListPage";
import { collapsible } from "./utils";
import { Score, WeightedScore, Weighting } from "../lib/scorer/Score";
import { bandFor, Default } from "../lib/util/bands";

export interface RepoForDisplay {
    url: string;
    repo: string;
    owner: string;
    id: string;
    score?: number;

    /**
     * Whether to show the full path of the repo
     */
    showFullPath?: boolean;
}

export interface RepoListProps {
    orgScore: WeightedScore;
    repos: RepoForDisplay[];
    virtualProjectCount: number;
    sortOrder: SortOrder;
    byOrg: boolean;
    expand: boolean;
    category: "*" | string;
}

function toRepoListItem(category: string, rfd: RepoForDisplay): React.ReactElement {
    let linkToIndividualProjectPage = `/repository?id=${encodeURI(rfd.id)}`;
    if (category && category !== "*") {
        linkToIndividualProjectPage += `&category=${category}`;
    }
    return <li key={rfd.url}>{rfd.showFullPath && `${rfd.owner} / `}{rfd.repo} {rfd.score && `(${rfd.score.toFixed(2)})`}:{" "}
        <a href={rfd.url}>
            Source
        </a>{" "}
        <a href={linkToIndividualProjectPage}>
            Insights
        </a>
    </li>;
}

function displayProjects(owner: string,
                         repos: RepoForDisplay[],
                         props: RepoListProps): React.ReactElement {
    const sorted = _.sortBy(repos,
        p => props.sortOrder === "score" ?
            p.score :
            p.repo.toLowerCase());
    return collapsible(owner, `${owner} (${repos.length} repositories)`,
        <ul>
            {sorted.map(r => toRepoListItem(props.category, r))}
        </ul>,
        repos.length === 1 || props.expand,
    );
}

export function RepoList(props: RepoListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.repos, p => p.owner);
    const orgCount = Object.entries(projectsByOrg).length;
    const categoryDescription = props.category === "*" ? undefined :
        <h3>Scoring by category: <span className="scoreCategoryName">{props.category}</span></h3>;
    return <div>
        <h2>{orgCount} organizations: {" "}
            {props.repos.length} repositories, {" "}
            {props.virtualProjectCount} virtual projects, {" "}
            {props.orgScore.weightedScore.toFixed(2)} / 5</h2>

        <h3>Workspace Summary</h3>
        {Object.keys(props.orgScore.weightedScores).map(k => explainScore(props.orgScore.weightedScores[k]))}

        <h3>{categoryDescription || "Repositories"}</h3>

        {props.byOrg ? reposByOrg(props) : reposRanked(props)}
    </div>;
}

export function explainScore(score: Score & { weighting: Weighting }): React.ReactElement {
    const conclusion = bandFor({
        horrible: { upTo: 1 },
        poor: { upTo: 2 },
        disappointing: { upTo: 3 },
        satisfactory: { upTo: 4 },
        good: { upTo: 4.5 },
        great: Default,
    }, score.score);
    return <li><i>{score.description || score.name}</i> is {conclusion} at {score.score.toFixed(2)} because {_.lowerFirst(score.reason)}</li>;
}

function reposByOrg(props: RepoListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.repos, p => p.owner);
    return <ul>
        {Object.entries(projectsByOrg).map(kv => displayProjects(kv[0], kv[1], props))}
    </ul>;
}

function reposRanked(props: RepoListProps): React.ReactElement {
    return <ul>
        {displayProjects("Ranked", props.repos, props)}
    </ul>;
}
