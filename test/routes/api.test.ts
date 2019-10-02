
import { Aspect } from "@atomist/sdm-pack-fingerprint";
import * as assert from "assert";
import { aspectSpecifiesNoEntropy } from "../../lib/routes/api";

describe("checking aspect for entropiness", () => {
    it("returns true if the aspect specified no entropy", () => {
        const aspect: Partial<Aspect<any>> = {
            stats: {
                defaultStatStatus: {
                    entropy: false,
                },
            },
        };
        const result = aspectSpecifiesNoEntropy(aspect as Aspect<any>);

        assert.strictEqual(result, true);

    });
});
