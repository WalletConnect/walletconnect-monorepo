import "mocha";
import sinon from "sinon";

import Core from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";

describe("Core", () => {
  it("does not duplicate initilization if `Core.start()` is called repeatedly", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    const initSpy = sinon.spy();
    // Spy on `crypto.init` as a proxy to the private `Core.initialize`.
    core.crypto.init = initSpy;
    await core.start();
    await core.start();
    expect(initSpy.callCount).to.equal(1);
  });
});
