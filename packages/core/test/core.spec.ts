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
  it("saves core instance in global scope", async () => {
    process.env.DISABLE_GLOBAL_CORE = "false";
    const core = await Core.init(TEST_CORE_OPTIONS);
    expect(globalThis._walletConnectCore_).to.deep.equal(core);
    globalThis._walletConnectCore_ = undefined;
    process.env.DISABLE_GLOBAL_CORE = "true";
  });
  it("saves core instance in global scope with custom storage prefix", async () => {
    process.env.DISABLE_GLOBAL_CORE = "false";
    const core = await Core.init({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
    expect(globalThis._walletConnectCore_test).to.deep.equal(core);
    expect(globalThis._walletConnectCore_).to.deep.equal(undefined);
    globalThis._walletConnectCore_test = undefined;
    process.env.DISABLE_GLOBAL_CORE = "true";
  });
  it("does not save core instance in global scope if disabled", async () => {
    process.env.DISABLE_GLOBAL_CORE = "true";
    await Core.init(TEST_CORE_OPTIONS);
    expect(globalThis._walletConnectCore_).to.deep.equal(undefined);
  });
  it("does not save core instance in global scope if disabled with custom storage prefix", async () => {
    process.env.DISABLE_GLOBAL_CORE = "true";
    await Core.init({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
    expect(globalThis._walletConnectCore_test).to.deep.equal(undefined);
    expect(globalThis._walletConnectCore_).to.deep.equal(undefined);
  });
  it("saves multiple core instances in global scope", async () => {
    process.env.DISABLE_GLOBAL_CORE = "false";
    const core1 = await Core.init(TEST_CORE_OPTIONS);
    const core2 = await Core.init({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
    expect(globalThis._walletConnectCore_).to.deep.equal(core1);
    expect(globalThis._walletConnectCore_test).to.deep.equal(core2);
    globalThis._walletConnectCore_ = undefined;
    globalThis._walletConnectCore_test = undefined;
    process.env.DISABLE_GLOBAL_CORE = "true";
  });
  it("saves multiple core instances in global scope with custom storage prefix", async () => {
    process.env.DISABLE_GLOBAL_CORE = "false";
    const core1 = await Core.init({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test1" });
    const core2 = await Core.init({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test2" });
    expect(globalThis._walletConnectCore_test1).to.deep.equal(core1);
    expect(globalThis._walletConnectCore_test2).to.deep.equal(core2);
    globalThis._walletConnectCore_test1 = undefined;
    globalThis._walletConnectCore_test2 = undefined;
    process.env.DISABLE_GLOBAL_CORE = "true";
  });
});
