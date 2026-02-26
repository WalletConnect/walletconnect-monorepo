import { expect, describe, it, beforeEach, vi } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import * as utils from "@walletconnect/utils";
import Sinon from "sinon";
import { Core, CORE_DEFAULT, Crypto } from "../src";
import { TEST_CORE_OPTIONS } from "./shared";

describe("Crypto", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));
  const core = new Core(TEST_CORE_OPTIONS);

  let crypto: Crypto;

  beforeEach(async () => {
    crypto = new Crypto(core, logger);
    await crypto.init();
  });

  it("initializes the keychain subcontroller a single time", async () => {
    const spy = Sinon.spy();
    const _crypto = new Crypto(core, logger);
    _crypto.keychain.init = spy;
    await _crypto.init();
    await _crypto.init();
    expect(spy.callCount).to.equal(1);
  });

  describe("generateKeyPair", () => {
    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.generateKeyPair()).to.throw("Not initialized. crypto");
    });
    it("generates a keyPair, sets it in the keychain and returns publicKey", async () => {
      const privateKey = utils.generateRandomBytes32();
      const publicKey = utils.generateRandomBytes32();
      vi.spyOn(utils, "generateKeyPair").mockReturnValue({ publicKey, privateKey });
      const keychainSpy = Sinon.spy();
      crypto.keychain.set = keychainSpy;
      const returnedPublicKey = await crypto.generateKeyPair();
      const [calledPublicKey, calledPrivateKey] = keychainSpy.getCall(0).args;
      expect(calledPublicKey).to.equal(publicKey);
      expect(calledPrivateKey).to.equal(privateKey);
      expect(returnedPublicKey).to.equal(publicKey);
    });
  });

  describe("generateSharedKey", () => {
    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.generateSharedKey("a", "b")).to.throw("Not initialized. crypto");
    });
    it("generates a shared symKey, sets it in the keychain and returns the topic", async () => {
      const overrideTopic = utils.generateRandomBytes32();
      const peerPublicKey = utils.generateRandomBytes32();
      const selfPublicKey = await crypto.generateKeyPair();
      const selfPrivateKey = crypto.keychain.get(selfPublicKey);
      const expectedSymKey = utils.deriveSymKey(selfPrivateKey, peerPublicKey);
      const spy = Sinon.spy();
      crypto.setSymKey = spy;
      await crypto.generateSharedKey(selfPublicKey, peerPublicKey, overrideTopic);
      const [calledSymKey, calledOverrideTopic] = spy.getCall(0).args;
      expect(calledSymKey).to.equal(expectedSymKey);
      expect(calledOverrideTopic).to.equal(overrideTopic);
    });
  });

  describe("setSymKey", () => {
    it("throws if not initialized", async () => {
      const invalidCrypto = new Crypto(core, logger);
      await expect(invalidCrypto.setSymKey("key")).rejects.toThrow("Not initialized. crypto");
    });
    it("sets expected topic-symKey pair in keychain, returns topic", async () => {
      const spy = Sinon.spy();
      crypto.keychain.set = spy;
      const fakeSymKey = utils.generateRandomBytes32();
      const topic = utils.hashKey(fakeSymKey);
      const returnedTopic = await crypto.setSymKey(fakeSymKey);
      const [calledTopic, calledSymKey] = spy.getCall(0).args;
      expect(calledTopic).to.equal(topic);
      expect(calledSymKey).to.equal(fakeSymKey);
      expect(returnedTopic).to.equal(topic);
    });
    it("sets expected topic-symKey pair in keychain if overrideTopic is passed", async () => {
      const spy = Sinon.spy();
      crypto.keychain.set = spy;
      const fakeSymKey = utils.generateRandomBytes32();
      const topic = utils.generateRandomBytes32();
      const returnedTopic = await crypto.setSymKey(fakeSymKey, topic);
      const [calledTopic, calledSymKey] = spy.getCall(0).args;
      expect(calledTopic).to.equal(topic);
      expect(calledSymKey).to.equal(fakeSymKey);
      expect(returnedTopic).to.equal(topic);
    });
  });

  describe("deleteKeyPair", () => {
    it("throws if not initialized", async () => {
      const invalidCrypto = new Crypto(core, logger);
      await expect(invalidCrypto.deleteKeyPair("key")).rejects.toThrow("Not initialized. crypto");
    });
    it("deletes the expected topic-symKey pair from keychain", async () => {
      const publicKey = utils.generateRandomBytes32();
      const spy = Sinon.spy();
      crypto.keychain.del = spy;
      await crypto.deleteKeyPair(publicKey);
      const [calledTopic] = spy.getCall(0).args;
      expect(calledTopic).to.equal(publicKey);
    });
  });

  describe("deleteSymKey", () => {
    it("throws if not initialized", async () => {
      const invalidCrypto = new Crypto(core, logger);
      await expect(invalidCrypto.deleteSymKey("key")).rejects.toThrow("Not initialized. crypto");
    });
    it("deletes the expected topic-symKey pair from keychain", async () => {
      const topic = utils.generateRandomBytes32();
      const spy = Sinon.spy();
      crypto.keychain.del = spy;
      await crypto.deleteSymKey(topic);
      const [calledTopic] = spy.getCall(0).args;
      expect(calledTopic).to.equal(topic);
    });
  });

  describe("encode", () => {
    const symKey = "5720435e682cd03ee45b484f9a213f0e3246a0ccc2cca183b72ab1cbfbefb702";
    const payload = { id: 1, jsonrpc: "2.0", result: "result" };
    // const encoded =
    //   "AG7iJl9mMl9K04REnuWaKLQU6kwMcQWUd69OxGOJ5/A+VRRKkxnKhBeIAl4JRaIft3qZKEfnBvc7/Fife1DWcERqAfJwzPI=";

    it("throws if not initialized", async () => {
      const invalidCrypto = new Crypto(core, logger);
      await expect(invalidCrypto.encode("topic", payload)).rejects.toThrow(
        "Not initialized. crypto",
      );
    });
    it.skip("encrypts `payload` if the passed topic is known", async () => {
      const topic = await crypto.setSymKey(symKey);
      // FIXME: needs to be tested dynamically because of random IV generation
      await crypto.encode(topic, payload);
    });
  });

  describe("decode", () => {
    const symKey = "5720435e682cd03ee45b484f9a213f0e3246a0ccc2cca183b72ab1cbfbefb702";
    const payload = { id: 1, jsonrpc: "2.0", result: "result" };
    const encoded =
      "AG7iJl9mMl9K04REnuWaKLQU6kwMcQWUd69OxGOJ5/A+VRRKkxnKhBeIAl4JRaIft3qZKEfnBvc7/Fife1DWcERqAfJwzPI=";

    it("throws if not initialized", async () => {
      const invalidCrypto = new Crypto(core, logger);
      await expect(invalidCrypto.decode("topic", "encoded")).rejects.toThrow(
        "Not initialized. crypto",
      );
    });
    it("decrypts `payload` if the passed topic is known", async () => {
      const topic = await crypto.setSymKey(symKey);
      const decoded = await crypto.decode(topic, encoded);
      expect(decoded).to.eql(payload);
    });
    it("should not throw on failed decrypt", async () => {
      const decoded = await crypto.decode("non-existent-topic", "dummymessage");
      expect(decoded).to.eql(undefined);
    });
  });
});
