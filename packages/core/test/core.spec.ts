import "mocha";
import sinon from "sinon";

import Core, { CORE_CONTEXT, CORE_PROTOCOL, CORE_VERSION } from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";

describe("Core", () => {
  it("provides the expected `storagePrefix` format", () => {
    const core = new Core(TEST_CORE_OPTIONS);
    expect(core.storagePrefix).to.equal(`${CORE_PROTOCOL}@${CORE_VERSION}:${CORE_CONTEXT}:`);
  });
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
