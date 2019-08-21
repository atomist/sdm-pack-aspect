import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import { extractTypeScriptSourceDirectories } from "../../../lib/aspect/node/TypeScriptSourceDirectories";

describe("Figure out where people keep their TS source", () => {

    it("finds none in a project with no TS source", async () => {
        const p = InMemoryProject.of({ path: "index.js", content: "// some JS" });

        const extractedFingerprints = await extractTypeScriptSourceDirectories(p);
        assert.strictEqual(extractedFingerprints.length, 0);
    });
    it("finds directories with TS source", async () => {
        const p = InMemoryProject.of({ path: "index.ts", content: "// some TS" });

        const extractedFingerprints = await extractTypeScriptSourceDirectories(p);
        assert.strictEqual(extractedFingerprints.length, 1);
        const fp = extractedFingerprints[0];
        assert.deepEqual(fp.data, { directories: ["."] });
    });
    it("puts directories with more TS source first", async () => {
        const p = InMemoryProject.of({ path: "index.ts", content: "// some TS" },
            { path: "src/whatever.ts", content: "// some TS" },
            { path: "src/more.ts", content: "// some TS" },
        );

        const extractedFingerprints = await extractTypeScriptSourceDirectories(p);
        assert.strictEqual(extractedFingerprints.length, 1);
        const fp = extractedFingerprints[0];
        assert.deepEqual(fp.data, { directories: ["src", "."] });
    });

    it("only cares about the top level directory", async () => {
        const p = InMemoryProject.of({ path: "index.ts", content: "// some TS" },
            { path: "src/bananas/whatever.ts", content: "// some TS" },
            { path: "src/carrots/more.ts", content: "// some TS" },
        );

        const extractedFingerprints = await extractTypeScriptSourceDirectories(p);
        assert.strictEqual(extractedFingerprints.length, 1);
        const fp = extractedFingerprints[0];
        assert.deepEqual(fp.data, { directories: ["src", "."] });
    });

    it("ties are alphabetical", async () => {
        const p = InMemoryProject.of({ path: "index.ts", content: "// some TS" },
            { path: "src/whatever.ts", content: "// some TS" },
            { path: "src/whatever2.ts", content: "// some TS" },
            { path: "lib/more.ts", content: "// some TS" },
            { path: "lib/more2.ts", content: "// some TS" },
        );

        const extractedFingerprints = await extractTypeScriptSourceDirectories(p);
        assert.strictEqual(extractedFingerprints.length, 1);
        const fp = extractedFingerprints[0];
        assert.deepEqual(fp.data, { directories: ["lib", "src", "."] });
    });

    it("ignores a test directory with TS source");
});
