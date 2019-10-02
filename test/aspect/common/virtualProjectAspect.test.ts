import * as assert from "assert";
import { virtualProjectAspect } from "../../../lib/aspect/common/virtualProjectAspect";

import { aspectSpecifiesNoEntropy } from "../../../lib/routes/api";

describe("the virtual projects aspect", () => {
    it("does not care about entropy", () => {
        const vpa = virtualProjectAspect();

        assert.strictEqual(aspectSpecifiesNoEntropy(vpa), true);
    });
});
