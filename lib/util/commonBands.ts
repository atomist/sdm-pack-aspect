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

import {
    BandCasing, bandFor,
    Bands,
    Default,
} from "./bands";

export type SizeBands = "low" | "medium" | "high";

export type AgeBands = "current" | "recent" | "ancient" | "prehistoric";

export const EntropySizeBands: Bands<SizeBands | "zero"> = {
    zero: { exactly: 0 },
    low: { upTo: 1 },
    medium: { upTo: 2 },
    high: Default,
};

export type StarBands = "½" | "⭐" | "⭐½" | "⭐⭐" | "⭐⭐½" | "⭐⭐⭐" | "⭐⭐⭐½"| "⭐⭐⭐⭐" | "⭐⭐⭐⭐½" | "⭐⭐⭐⭐⭐";

const StarCountBands: Bands<StarBands> = {
    "½": { exactly: .5},
    "⭐": { exactly: 1 },
    "⭐½": { exactly: 1.5 },
    "⭐⭐": { exactly: 2 },
    "⭐⭐½": { exactly: 2.5 },
    "⭐⭐⭐": { exactly: 3 },
    "⭐⭐⭐½": { exactly: 3.5 },
    "⭐⭐⭐⭐": { exactly: 4 },
    "⭐⭐⭐⭐½": { exactly: 4.5 },
    "⭐⭐⭐⭐⭐": Default,
};

export function starBand(score: number): string {
    return bandFor(StarCountBands,
        Math.round(score * 2) / 2,
        { casing: BandCasing.Sentence, includeNumber: false });
}
