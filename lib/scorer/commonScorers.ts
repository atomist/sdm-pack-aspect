import { RepositoryScorer } from "../aspect/AspectRegistry";
import { GitRecencyData, GitRecencyType } from "../aspect/git/gitActivity";
import { adjustBy } from "./scoring";
import { daysSince } from "../aspect/git/dateUtils";
import { FP } from "@atomist/sdm-pack-fingerprints";
import { CodeMetricsData, CodeMetricsType } from "../aspect/common/codeMetrics";
import { Language } from "@atomist/sdm-pack-sloc/lib/slocReport";
import { FiveStar } from "@atomist/sdm-pack-analysis";

export function anchorScoreAt(score: FiveStar): RepositoryScorer {
    return async () => {
        return {
            name: "anchor",
            reason: `Weight to ${score} stars to penalize repositories about which we know little`,
            score,
        };
    };
}

export function requireRecentCommit(opts: { days: number }): RepositoryScorer {
    return async repo => {
        const grt = repo.analysis.fingerprints.find(fp => fp.type === GitRecencyType) as FP<GitRecencyData>;
        if (!grt) {
            return undefined;
        }
        const date = new Date(grt.data.lastCommitTime);
        const days = daysSince(date);
        return {
            name: "recency",
            score: adjustBy(-days / opts.days),
            reason: `Last commit ${days} days ago`,
        };
    };
}

/**
 * Limit languages used in a project
 */
export function limitLanguages(opts: { limit: number }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        return {
            name: "multi-language",
            score: adjustBy(opts.limit - cm.data.languages.length),
            reason: `Found ${cm.data.languages.length} languages: ${cm.data.languages.map(l => l.language.name).join(",")}`,
        };
    };
}

export function limitLinesOfCode(opts: { limit: number }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        return {
            name: "total-loc",
            score: adjustBy(-cm.data.lines / opts.limit),
            reason: `Found ${cm.data.lines} total lines of code`,
        };
    };
}

export function limitLinesOfCodeIn(opts: { limit: number, language: Language }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        const target = cm.data.languages.find(l => l.language.name === opts.language.name);
        const targetLoc = target ? target.total : 0;
        return {
            name: `limit-${opts.language.name} (${opts.limit})`,
            score: adjustBy(-targetLoc / opts.limit),
            reason: `Found ${targetLoc} lines of ${opts.language.name}`,
        };
    };
}