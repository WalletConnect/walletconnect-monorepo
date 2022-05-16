import "mocha";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import pino from "pino";

import { Core, CORE_DEFAULT, CORE_STORAGE_PREFIX, Store, STORE_STORAGE_VERSION } from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";
import { ICore, IStore, SessionTypes } from "@walletconnect/types";

const MOCK_STORE_NAME = "mock-entity";

// TODO: Test persistence behavior
describe("Store", () => {
  const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));

  let core: ICore;
  let store: IStore<any, any>;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    store = new Store(core, logger, MOCK_STORE_NAME);
    await store.init();
  });

  it("provides the expected `storageKey` format", () => {
    const store = new Store(core, logger, MOCK_STORE_NAME);
    expect(store.storageKey).to.equal(
      CORE_STORAGE_PREFIX + STORE_STORAGE_VERSION + "//" + MOCK_STORE_NAME,
    );
  });

  describe("set", () => {
    it("creates a new entry for a new key", async () => {
      const key = "newKey";
      const value = {
        topic: "abc123",
        expiry: 1000,
      } as SessionTypes.Struct;
      await store.set(key, value);
      expect(store.length).to.equal(1);
      expect(store.keys.includes(key)).to.be.true;
      expect(store.values.includes(value)).to.be.true;
    });
    it("updates an existing entry for a a known key", async () => {
      const key = "key";
      const value = {
        topic: "111",
        expiry: 1000,
      } as SessionTypes.Struct;
      const updatedValue = {
        topic: "222",
        expiry: 1000,
      } as SessionTypes.Struct;
      await store.set(key, value);
      await store.set(key, updatedValue);
      expect(store.length).to.equal(1);
      expect(store.map.has(key)).to.be.true;
      expect(store.values.some((val: any) => val.topic === updatedValue.topic)).to.be.true;
    });
  });

  describe("get", () => {
    it("returns the value for a known key", async () => {
      const key = "key";
      const value = {
        topic: "abc123",
        expiry: 1000,
      } as SessionTypes.Struct;
      await store.set(key, value);
      expect(await store.get(key)).to.equal(value);
    });
    it("throws with expected error if passed an unknown key", async () => {
      const unknownKey = "unknown";
      expect(() => store.get(unknownKey)).to.throw(
        `No matching ${MOCK_STORE_NAME} with topic: ${unknownKey}`,
      );
    });
  });

  describe("delete", () => {
    it("removes a known key from the map", async () => {
      const key = "key";
      const value = {
        topic: "abc123",
        expiry: 1000,
      } as SessionTypes.Struct;
      await store.set(key, value);
      expect(store.length).to.equal(1);
      await store.delete(key, { code: 0, message: "reason" });
      expect(store.length).to.equal(0);
    });
    it("does nothing if key is unknown", async () => {
      await store.delete("key", { code: 0, message: "reason" });
      expect(store.length).to.equal(0);
    });
  });
});
