import { expect, describe, it } from "vitest";
import sinon from "sinon";
import Core from "../src";
import { TEST_CORE_OPTIONS } from "./shared";

describe("Core", () => {
  it("does not duplicate initialization if `Core.start()` is called repeatedly", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    const cryptoInitSpy = sinon.spy();
    const relayerInitSpy = sinon.spy();
    const heartbeatInitSpy = sinon.spy();
    // Spy on subcontroller `init` as a proxy to the private `Core.initialize`.
    core.crypto.init = cryptoInitSpy;
    core.relayer.init = relayerInitSpy;
    core.heartbeat.init = heartbeatInitSpy;
    await core.start();
    await core.start();
    expect(cryptoInitSpy.callCount).to.equal(1);
    expect(relayerInitSpy.callCount).to.equal(1);
    expect(heartbeatInitSpy.callCount).to.equal(1);
  });
});
