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

import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const systemRoot = path.parse(__dirname).root;

function containsPackageJson(dir: string): boolean {
    const doesThisFileExist = path.join(dir, "package.json");
    return fs.existsSync(doesThisFileExist);
}

function findPackageJsonAbove(dir: string): string | "nope" {
    if (containsPackageJson(dir)) {
        return dir;
    }
    if (systemRoot === dir) {
        return "nope";
    }
    return findPackageJsonAbove(path.resolve(dir, ".."));
}

export function packageRoot(dir: string = __dirname): string {
    const parentDirectoryContainingPackageJson = findPackageJsonAbove(dir);
    if (parentDirectoryContainingPackageJson === "nope") {
        // throw the error where we have context: the original directory they asked for
        throw new Error("No package.json found in any directory above " + dir);
    }
    return parentDirectoryContainingPackageJson;
}
