import { expect, describe, it, beforeEach } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import { Core, CORE_STORAGE_PREFIX, Store, STORE_STORAGE_VERSION } from "../src";
import { TEST_CORE_OPTIONS } from "./shared";
import { ICore, IStore, SessionTypes } from "@walletconnect/types";

const MOCK_STORE_NAME = "mock-entity";

describe("Store", () => {
  const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));

  let core: ICore;
  type MockValue = { id: string; value: string };
  let store: IStore<any, any>;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    store = new Store(core, logger, MOCK_STORE_NAME);
    await store.init();
  });

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      const store = new Store(core, logger, MOCK_STORE_NAME);
      expect(store.storageKey).to.equal(
        CORE_STORAGE_PREFIX + STORE_STORAGE_VERSION + "//" + MOCK_STORE_NAME,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const store = new Store(core, logger, MOCK_STORE_NAME);
      expect(store.storageKey).to.equal(
        CORE_STORAGE_PREFIX + STORE_STORAGE_VERSION + ":test" + "//" + MOCK_STORE_NAME,
      );
    });
  });

  describe("init", () => {
    const ids = ["1", "2", "3", "foo"];
    const STORAGE_KEY = CORE_STORAGE_PREFIX + STORE_STORAGE_VERSION + "//" + MOCK_STORE_NAME;

    beforeEach(() => {
      const cachedValues = ids.map((id) => ({ id, value: "foo" }));
      core.storage.setItem(STORAGE_KEY, cachedValues);
    });

    it("retrieves from cache using getKey", async () => {
      const store = new Store<string, MockValue>(
        core,
        logger,
        MOCK_STORE_NAME,
        undefined,
        (val) => val.id,
      );
      await store.init();
      for (const id of ids) {
        expect(store.keys).includes(id);
      }
    });

    it("safely overwrites values when retrieving from cache using getKey", async () => {
      const store = new Store<string, MockValue>(
        core,
        logger,
        MOCK_STORE_NAME,
        undefined,
        (val) => val.value,
      );
      await store.init();
      expect(store.keys).to.eql(["foo"]);
    });

    it("handles null and undefined cases", async () => {
      core.storage.setItem(STORAGE_KEY, [undefined, null, { id: 1, value: "foo" }]);
      const store = new Store<string, MockValue>(
        core,
        logger,
        MOCK_STORE_NAME,
        undefined,
        (val) => val.value,
      );
      await store.init();
      expect(store.keys).to.eql(["foo"]);
    });
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
    it("updates an existing entry for a known key", async () => {
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
    it("throws with expected error if passed an unknown key", () => {
      const unknownKey = "unknown";
      expect(() => store.get(unknownKey)).to.throw(
        `No matching key. ${MOCK_STORE_NAME}: ${unknownKey}`,
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
    it("should add deleted key to the recentlyDeleted list", async () => {
      const key = "key";
      const value = "value";
      await store.set(key, value);
      await store.delete(key, { code: 0, message: "reason" });
      try {
        await store.get(key);
      } catch (e) {
        expect(e.message).to.equal(
          `Missing or invalid. Record was recently deleted - mock-entity: ${key}`,
        );
      }
    });
    it("should cleanup recentlyDeleted when size limit is reached", async () => {
      //@ts-expect-error
      const itemsToDelete = store.recentlyDeletedLimit - 1;
      // populate recentlyDeleted just below the limit
      for (let i = 0; i < itemsToDelete; i++) {
        const key = `key${i}`;
        const value = `value${i}`;
        await store.set(key, value);
        await store.delete(key, { code: 0, message: "reason" });
      }
      //@ts-expect-error
      expect(store.recentlyDeleted?.length).to.be.greaterThan(1);
      //@ts-expect-error
      expect(store.recentlyDeleted?.length).to.equal(itemsToDelete);
      // add one more to reach the limit
      await store.set("test", "test");
      await store.delete("test", { code: 0, message: "reason" });

      // check that the recentlyDeleted list has been halved
      //@ts-expect-error
      expect(store.recentlyDeleted?.length).to.be.greaterThan(1);
      //@ts-expect-error
      expect(store.recentlyDeleted?.length).to.equal(store.recentlyDeletedLimit / 2);
    });
  });

  describe("getAll", () => {
    const key1 = "key1";
    const key2 = "key2";
    const value1 = { topic: "abc123", expiry: 1000, active: false };
    const value2 = { topic: "abc456", expiry: 1000, active: true };

    it("returns all values if no filter was provided", async () => {
      await store.set(key1, value1);
      await store.set(key2, value2);
      const all = store.getAll();
      expect(all.length).to.equal(2);
    });
    it("only returns values that satisfy filter", async () => {
      await store.set(key1, value1);
      await store.set(key2, value2);
      const filtered = store.getAll({ active: true });
      expect(filtered.length).to.equal(1);
      expect(filtered[0].active).to.equal(true);
    });
  });
});
