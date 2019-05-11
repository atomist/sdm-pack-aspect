import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import { GradleSubprojectFinder } from "../../lib/analysis/gradleSubprojectFinder";
import { SubprojectStatus } from "../../lib/analysis/subprojectFinder";

describe("gradleSubprojectFinder", () => {
    it("says this is a top-level project if there's a build.gradle at root", async () => {
        const project = InMemoryProject.of({ path: "build.gradle", content: "whatever" });
        const result = await GradleSubprojectFinder(project);
        assert.deepStrictEqual(result, {
            status: SubprojectStatus.RootOnly,
        });
    });

    it("says this is unknown if there's no build.gradle at all", async () => {
        const project = InMemoryProject.of({ path: "something/else", content: "whatever" });
        const result = await GradleSubprojectFinder(project);
        assert.deepStrictEqual(result, {
            status: SubprojectStatus.Unknown,
        });
    });

    it("finds multiple projects if there is no root build.gradle but some down in dirs", async () => {
        const project = InMemoryProject.of(
            { path: "something/else/build.gradle", content: "whatever" },
            { path: "somewhere/build.gradle", content: "stuff" });
        const result = await GradleSubprojectFinder(project);
        assert.deepStrictEqual(result, {
            status: SubprojectStatus.IdentifiedPaths,
            paths: ["something/else", "somewhere"],
        });
    });

    it("ignores deeper build.gradles if one exists at root", async () => {
        const project = InMemoryProject.of(
            { path: "something/else/build.gradle", content: "whatever" },
            { path: "build.gradle", content: "stuff" },
        );
        const result = await GradleSubprojectFinder(project);
        assert.deepStrictEqual(result, {
            status: SubprojectStatus.RootOnly,
        });
    });
});
