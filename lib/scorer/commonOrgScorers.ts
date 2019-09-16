import { FiveStar } from "./Score";
import { OrgScorer } from "../aspect/AspectRegistry";

import * as _ from "lodash";

const average = (array) => array.reduce((a, b) => a + b) / array.length;

export const AverageRepoScore: OrgScorer = {
    name: "average",
    score: async od => {
        const scores: number[] = od.repos.map(r => r.score);
        const score: FiveStar = average(scores) as any as FiveStar;
        return {
            reason: "average",
            score,
        }
    },
};

export const WorstRepoScore: OrgScorer = {
    name: "worst",
    score: async od => {
        const scores: number[] = od.repos.map(r => r.score);
        const score = _.min(scores) as FiveStar;
        return {
            reason: "worst",
            score,
        }
    },
};

export const EntropyScore: OrgScorer = {
    name: "entropy",
    score: async od => {
        const scores: number[] = od.fingerprintUsage.map(f => {
            if (f.entropy > 3) {
                return 1;
            }
            if (f.entropy > 2) {
                return 2;
            }
            if (f.entropy > 1) {
                return 3;
            }
            if (f.entropy > .5) {
                return 4;
            }
            return 5;
        });
        const score: FiveStar = average(scores) as any as FiveStar;
        return {
            reason: "entropy",
            score,
        }
    },
};
