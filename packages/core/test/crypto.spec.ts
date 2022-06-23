import "mocha";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import * as utils from "@walletconnect/utils";
import * as encoding from "@walletconnect/encoding";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import pino from "pino";
import Sinon from "sinon";

import { Core, CORE_DEFAULT, Crypto } from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";

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
      // Stub `utils.generateKeyPair` to return predictable values.
      Sinon.stub(utils, "generateKeyPair").returns({ publicKey, privateKey });
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
      const expectedSymKey = utils.deriveSymmetricKey(
        utils.deriveSharedKey(selfPrivateKey, peerPublicKey),
      );
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
      await expect(invalidCrypto.setSymKey("key")).to.eventually.be.rejectedWith(
        "Not initialized. crypto",
      );
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
      await expect(invalidCrypto.deleteKeyPair("key")).to.eventually.be.rejectedWith(
        "Not initialized. crypto",
      );
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
      await expect(invalidCrypto.deleteSymKey("key")).to.eventually.be.rejectedWith(
        "Not initialized. crypto",
      );
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

  describe("encrypt", () => {
    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.encrypt("topic", "message")).to.throw("Not initialized. crypto");
    });
    it("throws if the passed topic is not known", () => {
      const topic = utils.generateRandomBytes32();
      expect(() => crypto.encrypt(topic, "message")).to.throw();
    });
    it("resolves symKey from `topic` param and encrypts with `message` param", async () => {
      const message = "some message";
      const symKey = utils.generateRandomBytes32();
      // Set a topic-symKey pair in the keychain to later retrieve via `encrypt`.
      const topic = await crypto.setSymKey(symKey);
      const spy = Sinon.spy();
      // @ts-ignore
      utils.encrypt = spy;
      crypto.encrypt(topic, message);
      const [payload] = spy.getCall(0).args;
      expect(payload).to.deep.equal({ symKey, message });
    });
  });

  describe("decrypt", () => {
    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.decrypt("topic", "encoded")).to.throw("Not initialized. crypto");
    });
    it("throws if the passed topic is not known", () => {
      const topic = utils.generateRandomBytes32();
      expect(() => crypto.decrypt(topic, "encoded")).to.throw();
    });
    it("resolves symKey from `topic` param and decrypts `encoded` param", async () => {
      const encoded = "encoded";
      const symKey = utils.generateRandomBytes32();
      // Set a topic-symKey pair in the keychain to later retrieve via `decrypt`.
      const topic = await crypto.setSymKey(symKey);
      const spy = Sinon.spy();
      // @ts-ignore
      utils.decrypt = spy;
      crypto.decrypt(topic, encoded);
      const [payload] = spy.getCall(0).args;
      expect(payload).to.deep.equal({ symKey, encoded });
    });
  });

  describe("encode", () => {
    const payload = { id: 1, jsonrpc: "2.0", result: "result" };

    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.encode("topic", payload)).to.throw("Not initialized. crypto");
    });
    it("encodes `payload` as hex string if the passed topic is not known", () => {
      const topic = utils.generateRandomBytes32();
      const result = crypto.encode(topic, payload);
      expect(result).to.equal(encoding.utf8ToHex(safeJsonStringify(payload)));
    });
    it("encrypts `payload` if the passed topic is known", async () => {
      const symKey = utils.generateRandomBytes32();
      const topic = await crypto.setSymKey(symKey);
      const spy = Sinon.spy();
      crypto.encrypt = spy;
      crypto.encode(topic, payload);
      const [calledTopic, calledMessage] = spy.getCall(0).args;
      expect(calledTopic).to.equal(topic);
      expect(calledMessage).to.equal(safeJsonStringify(payload));
    });
  });

  describe("decode", () => {
    const payload = { id: 1, jsonrpc: "2.0", result: "result" };
    const hexPayload = encoding.utf8ToHex(safeJsonStringify(payload));

    it("throws if not initialized", () => {
      const invalidCrypto = new Crypto(core, logger);
      expect(() => invalidCrypto.decode("topic", "encoded")).to.throw("Not initialized. crypto");
    });
    it("decodes `encoded` from hex to utf8 string if the passed topic is not known", () => {
      const topic = utils.generateRandomBytes32();
      const result = crypto.decode(topic, hexPayload);
      expect(result).to.deep.equal(safeJsonParse(encoding.hexToUtf8(hexPayload)));
    });
    it("decrypts `payload` if the passed topic is known", async () => {
      const symKey = utils.generateRandomBytes32();
      const topic = await crypto.setSymKey(symKey);
      const spy = Sinon.spy(() => "message");
      crypto.decrypt = spy;
      crypto.decode(topic, hexPayload);
      const [calledTopic, calledEncoded] = spy.getCall(0).args;
      expect(calledTopic).to.equal(topic);
      expect(calledEncoded).to.equal(hexPayload);
    });
  });
});
