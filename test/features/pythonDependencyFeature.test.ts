import * as assert from "assert";
import { findDependenciesFromRequirements, PythonDependency } from "../../lib/feature/domain/pythonDependenciesFeature";

describe("parsing requirements.txt", () => {
    it("can see a lib with no specifier", async () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("nose-cov", all);

        assert(result, "Library not found: nose-cov");
        assert.strictEqual(result.requirementLine, "nose-cov");
    });

    it.skip("can see a lib with a version specifier");

    it.skip("ignores comments");

    it.skip("follows references (I don't expect to implement this)");

    it.skip("Ignores options");

    it.skip("Strips comments from the end of the line");

    it.skip("finds library names with numbers");

    it.skip("removes spaces");

    it.skip("Combines lines continued with slash");

    it.skip("Includes the environment specifier");
});

function findByLibraryName(libraryName: string, pds: PythonDependency[]): PythonDependency | undefined {
    return pds.find(pd => pd.libraryName === libraryName);
}

const sample = `#
####### example-requirements.txt #######
# nose-that-is-commented-out
###### Requirements without Version Specifiers ######
nose
nose-cov
beautifulsoup4
#
###### Requirements with Version Specifiers ######
#   See https://www.python.org/dev/peps/pep-0440/#version-specifiers
docopt == 0.6.1             # Version Matching. Must be version 0.6.1
keyring >= 4.1.1            # Minimum version 4.1.1
coverage != 3.5             # Version Exclusion. Anything except version 3.5
Mopidy-Dirble ~= 1.1        # Compatible release. Same as >= 1.1, == 1.*
#
###### Refer to other requirements files ######
-r other-requirements.txt
#
#
###### A particular file ######
./downloads/numpy-1.9.2-cp34-none-win32.whl
http://wxpython.org/Phoenix/snapshot-builds/wxPython_Phoenix-3.0.3.dev1820+49a8884-cp34-none-win_amd64.whl
#
###### Additional Requirements without Version Specifiers ######
#   Same as 1st section, just here to show that you can put things in any order.
rejected
green
# environbment specified should be included
SomeProject; sys_platform == 'win32'
`;
