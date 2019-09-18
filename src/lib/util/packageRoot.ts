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
