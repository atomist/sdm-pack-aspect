# Developer Guide

The ultimate value of aspects is the potential to develop and combine them in a unique way
 to address the goals of your organization, helping you understand and take control of important aspects of code, configuration and process.

In keeping with the Atomist philosophy of *do it in code*, extensibility is in TypeScript code.

You can write your own code to comprehend aspects unique to your projects, and also contribute code that will be useful to other users.

The following are the key extension points:

- **Aspects**, which extract **fingerprint** data from repositories allowing visualization and (optionally) rolling out updates and on-change workflows.
- **Taggers**, which provide insights based on fingerprint data extracted by aspects.
- **Scorers**, which help to rank repositories. Scorers enable you to gamify development at scale and reward or penalize good or bad usages.
- **Custom reporters**, which can use data captured by aspects for wholly custom reports.

The key underlying concept is that of a **fingerprint**: a snapshot of a concern within a project--for example, the version of a particular library. However, fingerprints can encompass much more than merely dependencies. Out of the box examples include:

- Docker base images and ports
- Spring Boot version
- .NET target framework
- CI pipeline files
- Exposed secrets
- Git branching and recency of commit activity
- Build time

User examples include:

-  The presence and state of particular security files
-  Logging configuration
-  The configuration of metrics export
-  Canonicalized representation of sensitive code that, when changed, should trigger stringent review
-  Library usage idioms in code
-  Language usage
-  SQL statements and database usage
 
Fingerprints are persisted and are the basis for querying and visualization.

## Aspects

### Aspect interface

### Core aspect methods
The `Aspect` interface is central to analysis.
The following methods are the most important:

- `name`: An aspect's name must be unique in your workspace.
- `displayName`: Human readable name.
- `extract` Logic to extract zero or more fingerprints from the current project, using Atomist's `Project` API. Also has access to the current push, allowing it to see what files have changed, who made the push etc. All fingerprints created by an aspect must have the same `type` property and the same data payload structure, as determined by the `DATA` parameter.

### Understanding the extract method
The `extract` method extracts zero or more fingerprints from a push to a project. Most `extract` method implementations focus on the state of the project, looking into its files.

The signature is as follows:

```typescript
export declare type ExtractFingerprint<DATA = any> = 
	(p: Project, pli: PushImpactListenerInvocation) => Promise<FP<DATA> | Array<FP<DATA>>>;
```

Most implementations only use the first argument. The second
argument is used to look at information about the push, such as files changed.

An example, looking for a specific file (`CODE_OF_CONDUCT.md`):

```typescript
extract: async p => {
    const codeOfConductFile = await
        p.getFile("CODE_OF_CONDUCT.md");
    if (codeOfConductFile) {
        const content = await codeOfConductFile.getContent();
        const data = {
            title: titleOf(content),
            content,
        };
        return {
            name: CodeOfConductType,
            type: CodeOfConductType,
            data,
            sha: sha256(JSON.stringify(data)),
        };
    }
    return undefined;
},
```

A fingerprint has the following key fields:

- `type`: Corresponds to the type of the aspect emitting it
- `name`: Unique to this fingerprint. The same as the type if the aspect emits only one fingerprint.
- `data`: Data structure containing information core to this fingerprint.
- `sha`: Unique hash calculated from fingerprint state. Used to determine whether two fingerprints differ. Typically a computation on the stringified form of the `data` proper.

The convenient `fingerprintOf` function simplifies fingerprint creation by using default sha-ing. Thus the code of conduct fingerprint could be simplified as follows:

```typescript
return fingerprintOf({
    type: CodeOfConductType,
    data,
});
```
The `name` need not be specified in the common case where the aspect emits only one type of fingerprint and it's the same as the `type`. Thus the `extract` method of the code of conduct fingerprint could be simplified as follows:


#### Optional methods 

Many methods on the `Aspect` interface are optional.

```typescript
export interface Aspect<DATA = any> {

    /**
     * Displayable name of this aspect. Used only for reporting.
     */
    readonly displayName: string;

    /**
     * prefix for all fingerprints that are emitted by this Aspect
     */
    readonly name: string;

    /**
     * Link to documentation for this Aspect. This can help people
     * understand the results graphs and results from the analysis
     * enabled here.
     *
     * You might provide a link to the typedoc for Aspects you define,
     * or an internal page describing why you created this and what
     * people can do about their results.
     */
    readonly documentationUrl?: string;
    
    /**
     * Function to extract fingerprint(s) from this project
     */
    extract: ExtractFingerprint<DATA>;
    
     /**
     * Function to create any new fingerprint based on fingerprints
     * found by extract method. Implementations must observe the path
     * (if set) in the original fingerprints.
     */
    consolidate?: (fps: FP[]) => Promise<FP<DATA> | Array<FP<DATA>>>;

    /**
     * Function to apply the given fingerprint instance to a project
     */
    apply?: ApplyFingerprint<FPI>;

    summary?: DiffSummaryFingerprint;

    /**
     * Convert a fingerprint value to a human readable string
     * fpi.data is a reasonable default
     */
    toDisplayableFingerprint?(fpi: FPI): string;

    /**
     * Convert a fingerprint name such as "npm-project-dep::atomist::automation-client"
     * to a human readable form such as "npm package @atomist/automation-client"
     * @param {string} fingerprintName
     * @return {string}
     */
    toDisplayableFingerprintName?(fingerprintName: string): string;

    /**
     * Based on the given fingerprint type and name, suggest ideals
     * order of recommendation strength
     */
    suggestedIdeals?(type: string, fingerprintName: string): Promise<Ideal[]>;

    /**
     * Workflows to be invoked on a fingerprint change. This supports use cases such as
     * reacting to a potential impactful change and cascading changes to other projects.
     */
    workflows?: FingerprintDiffHandler[];

    /**
     * Indications about how to calculate stats for this aspect across
     * multiple projects. An aspect without AspectStats will have its entropy
     * calculated by default.
     */
    stats?: AspectStats;
}
```
The `DATA` type parameter is the type of the `data` property of fingerprints created by this aspect.

### Enabling updates
Fingerprints can not only be extracted from projects: they can be **applied**. This means ensuring that a project reflects a particular state of the relevant fingerprint.

The key method on `Aspect` is the optional `apply` method: an Atomist **code transform** that uses the Project API to modify a project to achieve this.
Atomist takes care of rolling out the changes across as many repositories as are needed.

### The consolidate method

The optional `consolidate` method works with fingerprints previously extracted by _all_ aspects run on the repository. This means it can establish facts such as "is any CI pipeline set up in tis project," which can only be determined on the basis of the work of multiple other aspects' `extract` methods. For example, this might be implemented as follows:

```typescript
consolidate: async fps => {
    const found = fps.filter(fp => ["travis", "jenkins", "circle"].includes(fp.type));
    return found.length > 0 ?
        fingerprintOf({ type: "ci", data: { tools: found.map(f => f.type)} }) :
        undefined;
} 

```

It is common for aspects using `consolidate` to return the empty 
array from their `extract` method.

Like the `extract` method, `consolidate` can also access the project and push:

```typescript
consolidate?: (fps: FP[], p: Project, pili: PushImpactListenerInvocation) => Promise<FP<DATA> | Array<FP<DATA>>>;

```

### Workflows
Aspects can respond to change in the managed fingerprint.

tbd

## Taggers
Taggers work with fingerprints emitted by aspects to provide particular insights. Taggers are simpler to write than aspects.

Taggers do not have access to project data so can be created and updated without the need to re-analyze to update persistent data.

Taggers are comparable to aspects using `consolidate` without `extract`. The difference is in the lack of persistence of tags. This means the loss of a permanent record, but also allows very rapid iteration, simply restarting the SDM after each change.

### Simple taggers

A tagger is an object with a name, description and test method with access to repo identification and fingerprints. Taggers will be invoked for each fingerprint on a project. Taggers are normally created as object literals. For example:

```typescript
{
    name: "docker",
    description: "Docker status",
    test: async repo => repo.analysis.fingerprints
    	.some(fp => fp.type === DockerFrom.name),
}

```
This will cause every project that has a fingerprint of type `DockerFrom.name` to be tagged with `docker`.

Taggers can check for a combination of fingerprints.

For example:

```typescript
{
	name: opts.name || "hot",
    description: "How hot is git",
    test: async repo => {
        const grt = repo.analysis.fingerprints.find(fp => fp.type === GitRecencyType);
        const acc = repo.analysis.fingerprints.find(fp => fp.type === GitActivesType);
        if (!!grt && !!acc) {
            const days = daysSince(new Date(grt.data));
            if (days < opts.hotDays && acc.data.count > opts.hotContributors) {
                return true;
            }
        }
        return false;
    },
};
```

This will cause every project that has a `GitRecency` fingerprint of less than a given number of days ago and a `GitActives` fingerprint showing a required number of active committers to the default branch to be tagged with `hot`.

Taggers have an optional `severity` property for which the legal values are `info`, `warn` and `error`. If you set this value to `warn` or `error` the severity will be returned along with the data payload and the UI will prominently render the relevant tag.

## Scorers
Implement the `RepositoryScorer` interface:

```typescript
export interface RepositoryScorer {

	  /**
     * Name of the scorer. Will be included in all scores.
     */
    readonly name: string;

    /**
     * Category to include in scores, if any
     */
    readonly category?: string;
    
    /**
     * Function that knows how to score a repository.
     * @param repo repo we are scoring
     * @param allRepos context of this scoring activity
     * @return undefined if this scorer doesn't know how to score this repository.
     */
    scoreFingerprints: (r: RepoToScore) => Promise<ScorerReturn>;

}
export type RepositoryScorer = (repo: TaggedRepo, allRepos: TaggedRepo[]) => Promise<Score | undefined>;

```

> RepositoryScorers work with data extracted by aspects.

An example:

```typescript
export const TypeScriptProjectsMustUseTsLint: RepositoryScorer = {
    name: "has-tslint",
    scoreFingerprints: async repo => {
        const isTs = repo.analysis.fingerprints.some(fp => fp.type === TypeScriptVersionType);
        if (!isTs) {
            return undefined;
        }
        const hasTsLint = repo.analysis.fingerprints.some(fp => fp.type === NpmDeps.name && fp.data[0] === "tslint");
        return {
            score: hasTsLint ? 5 : 1,
            reason: hasTsLint ? "TypeScript projects should use tslint" : "TypeScript project using tslint",
        };
    },
};
```

## Adding your aspects and taggers

Pass aspects, taggers and scorers into the options structure parameter of the `aspectSupport` function that creates the Aspect extension pack to add to an SDM.

```typescript
aspectSupport({
	 // Array of aspects
    aspects,

    // Record type. Key is scoring name, value a scorer or list
    // These scorers will run at fingerprint time and persist
    // their scores
    scorers: {
        all: scorers(undesirableUsageChecker),
        commitRisk: [
            commonCommitRiskScorers.fileChangeCount({ limitTo: 2 }),
            commonCommitRiskScorers.pomChanged(),
        ],
    },

	 // Scorers that run in memory rather than being persisted in fingerprints
    inMemoryScorers: commonScorers.exposeFingerprintScore("all"),

	// Array of taggers
    taggers,

```

The `inMemoryScorers` field is useful during development. It uses the `RepositoryScorer` interface but enables scorers to be changed between SDM restarts. This is helpful while iterating on scorers. When they mature they can be promoted to the `scorers` field, where their data will be persisted.

## Advanced Concepts

### Typed aspects
It is good practice to provide a `DATA` type parameter to your aspects. This helps to ensure that your fingerprint extraction and manipulation code makes sense.

### Aspect granularity
Keep your aspects fine-grained. An aspect should address a single concern. Some aspects emit many fingerprints from a single repository. For example, the npm dependency aspect emits one fingerprint for every npm dependency found in a project.

### Aspect composition
Aspects can depend on other aspects in the implementation of their `consolidate` method. All `consolidate` methods will be invoked after all `extract` methods have already run.

### Constructing fingerprints

Sometimes fingerprint data may need to be canonicalized. For example, consider content in which whitespace is irrelevant. It could be removed before sha-ing data. This will ensure that visualization doesn't indicate drift where there is only cosmetic difference. It also makes on change aspect workflows more meaningful by eliminating false positives.

### Stats
Aspects can provide information about their meaning at scale, in their optional `stats` property. For example:

```typescript
stats: {
    defaultStatStatus: {
        entropy: false,
    },
    basicStatsPath: "lines",
},
```
This indicates that of the stats calculated by default, entropy is not meaningful. For many aspects, entropy is meaningful. For example, we want to understand the drift of library versions. For some, however, like line count in a particular language, entropy is meaningless.

The `basicStatsPath` property, if supplied, specifies a path within the `data` property of the fingerprints created by this aspect that contains a single number that's meaningful to compare. For example, this _would_ make sense with line count. The `basicStatsPath` property may be nested, using `.` notation.

### Efficiency

All aspect `extract` methods need to run on every push to the default branch, and on an all repositories when a new organization is onboarded into the Atomist service. Thus it is important to consider the cost of their implementation.

Avoid retrieving more data than necessary. Some tips:

- If possible, ask for files by path via `project.getFile(path)` rather than iterating over files
- Use the most specific glob patterns possible
- When iterating over files and looking at content, exclude binary files using `file.isBinary()`
- Perform file iteration via generator utility methods in the `Project` API, terminating iteration once you've found what you want.

When testing aspects locally with `org-visualizer`, check the SDM
logs for information about the time taken by each aspect. This will
help to indicate if you have expensive outlier aspects.

>Consider using the `consolidate` method if it's possible to work with data extracted by a previous aspect. This minimizes the number of project reads and can avoid the need to parse files again.

### Parsing project content
The Atomist Project API has a variety of parsing technologies available, including [microgrammars](https://github.com/atomist/microgrammar). These are useful in extracting and applying fingerprints.

See the `microgrammarMatchAspect` function for an example.

### Banding display names

Sometimes visualization is more understandable if we band numeric returns, enabling them to be grouped in a sunburst. The following code uses the `bandFor` utility function to group branch count fingerprints:

```typescript
toDisplayableFingerprint: fp => {
    return bandFor<SizeBands | "excessive">({
        low: { upTo: 5 },
        medium: { upTo: 12 },
        high: { upTo: 12 },
        excessive: Default,
    }, fp.data.count, { includeNumber: true });
},
```

### VirtualProjectFinder

Some repositories contain multiple *virtual* projects: projects one or more level down from the root. For example, there may be a Java backend service in one directory and a React web app in another.

The `VirtualRepoFinder` interface enables `org-visualizer` to comprehend such virtual projects.

This is configured in `aspects.ts` as follows:

```typescript
const virtualProjectFinder: VirtualProjectFinder = fileNamesVirtualProjectFinder(
    "package.json", "pom.xml", "build.gradle", "requirements.txt",
);
```

This identifies Node projects, Maven and Gradle projects and Python projects.

You can add more files to this list, or implement your own `VirtualProject` finder by implementing the following interface:

```typescript
export interface VirtualProjectFinder {
    readonly name: string;
    /**
     * Determine virtual project information for this project
     * @param {Project} project
     * @return {Promise<VirtualProjectInfo>}
     */
    findVirtualProjectInfo: (project: Project) => Promise<VirtualProjectInfo>;
}
```

### Custom Reports

To add custom reports, add to the record type in `lib/customize/customReporters.ts`. Writing a custom report is only necessary for unusual requirements.

## Library functionality
This project contains useful library functionality in the form of reusable aspects, taggers and scoring.

### Common aspects
Some useful concrete aspects in this project:

- License: Extract license data
- CodeOfConduct: Look for code of conduct files
- ExposedSecrets: Use regular expressions to scan projects for exposed secrets. Parameterized by the `secrets.yml` file in your project.
- BranchCount: Count branches in git
- GitRecency: Recency of last commit to default branch
- gitActiveCommitters: Activity level in Git

### Aspect creation functions
The following utility functions help create your own aspects:

- classificationAspect: Add zero or more tags to a uniquely named fingerprint, using a number of classification functions
- globAspect: Check for the presence of files matching a blob.
- microgrammarMatchAspect: Look for a microgrammar match in files. Useful for picking out project content.
- fileMatchAspect: Check for presence of a match within the AST of files matching the glob. Integrates with Atomist Project API parsing infrastructure.

See [aspects.ts](https://github.com/atomist/org-visualizer/blob/c076a6d734b51ce4f18830a50c1e4b986a3a0ed6/lib/aspect/aspects.ts#L85) in the `org-visualizer` project for an example use of these and other aspects.

An example of globAspect:

```typescript
export const ChangelogAspect: Aspect =
globAspect({
    name: "changelog",
    displayName: undefined,
    glob: "CHANGELOG.md",
});
```

### Common taggers
See the `commonTaggers` file for generally useful taggers.

### Common Scorers

See the `commonScorers` file for common scorers. You can assemble these along with your own scorers to uniquely



