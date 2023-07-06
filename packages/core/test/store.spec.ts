import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import {
  Core,
  CORE_STORAGE_PREFIX,
  RELAYER_PROVIDER_EVENTS,
  Store,
  STORE_STORAGE_VERSION,
} from "../src";
import { TEST_CORE_OPTIONS } from "./shared";
import { ICore, IStore, SessionTypes } from "@walletconnect/types";
import { generateRandomBytes32 } from "@walletconnect/utils";

const MOCK_STORE_NAME = "mock-entity";

// TODO: Test persistence behavior
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

  it("provides the expected `storageKey` format", () => {
    const store = new Store(core, logger, MOCK_STORE_NAME);
    expect(store.storageKey).to.equal(
      CORE_STORAGE_PREFIX + STORE_STORAGE_VERSION + "//" + MOCK_STORE_NAME,
    );
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

  describe("persistence", () => {
    const n_restarts = 2; // number of restarts to use for persistence tests
    const n_pairings = 3; // number of pairings to test
    const n_sessions = 3; // number of sessions to test

    const test_values = [
      { id: "1", value: "foo" },
      { id: "2", value: "bar" },
      { id: "3", value: "baz" },
    ];

    // meta is used to provide a uniq id for the db, to avoid conflicts
    const init = async (id: string) => {
      const coreOptions = {
        ...TEST_CORE_OPTIONS,
        storageOptions: { database: `tmp/${id}.db` },
      };
      core = new Core(coreOptions);
      await core.start();
    };

    beforeEach(async ({ meta }) => {
      await init(meta.id);
    });

    it("repopulate values with getKey correctly after restarts", async ({ meta }) => {
      store = new Store<string, MockValue>(
        core,
        logger,
        MOCK_STORE_NAME,
        undefined,
        (val) => val.value,
      );
      await store.init();

      // load mock data
      test_values.forEach((val) => store.set(val.id, val));
      expect(store.getAll()).to.toMatchObject(test_values);

      // restart core
      for (let i = 0; i < n_restarts; i++) {
        await init(meta.id);
        expect(store.getAll()).to.toMatchObject(test_values);
      }

      // clear mock data
      store.getAll().forEach((val) => store.delete(val.id, { code: 0, message: "reason" }));
      expect(store.getAll()).to.toMatchObject([]);
    });

    /**
     * Use a temp core to pair with, restarts, and checks that the pairing keys are in the correct state
     */
    it("should keep keys in correct state after pair dis/connect", async ({ meta }) => {
      const temp_core = new Core(TEST_CORE_OPTIONS); // init new core to pair with
      await temp_core.start();
      await temp_core.pairing.init();

      core.pairing.init();

      // track topics across restarts
      const topics: string[] = [];

      // create pairings
      for (let i = 0; i < n_pairings; i++) {
        const { topic, uri } = await temp_core.pairing.create();
        topics.push(topic);
        await core.pairing.pair({ uri });
      }

      // restart
      for (let i = 0; i < n_restarts; i++) {
        await init(meta.id);
        expect(core.pairing.pairings.keys).to.deep.equals(topics);
        expect(core.pairing.pairings.keys).to.deep.equal(temp_core.pairing.pairings.keys);
      }

      // disconnect pairings
      for (let i = 0; i < n_pairings; i++) {
        const topic = topics.pop();
        if (!topic) throw new Error("topic not found");
        await temp_core.pairing.disconnect({ topic });
      }

      // restart
      for (let i = 0; i < n_restarts; i++) {
        await init(meta.id);
        expect(core.pairing.pairings.keys).to.deep.equal([]);
        expect(core.pairing.pairings.keys).to.deep.equal(temp_core.pairing.pairings.keys);
      }
    });

    it("should keep keys in correct state after session un/sub + restart", async ({ meta }) => {
      const topic = generateRandomBytes32();
      const subscriber = core.relayer.subscriber;

      for (let i = 0; i < n_sessions; i++) {
        // subscribe
        await subscriber.subscribe(topic);
        expect(subscriber.subscriptions.size).to.equal(1);

        // restart
        await init(meta.id);
        expect(subscriber.subscriptions.size).to.equal(1);

        // unsubscribe
        await subscriber.unsubscribe(topic);
        expect(subscriber.subscriptions.size).to.equal(0);
      }
    });
  });
});
