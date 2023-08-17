import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import { ICore, IStore } from "@walletconnect/types";
import { TEST_CORE_OPTIONS, disconnectSocket, throttle } from "./shared";
import { Core, Store } from "../src";
import { generateRandomBytes32 } from "@walletconnect/utils";

let core: ICore;
let store: IStore<any, any>;
const n_restarts = 1; // number of restarts to use for persistence tests

const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));
type MockValue = { id: string; value: string };
const MOCK_STORE_NAME = "persistent-store";
const storeTestValues = [
  { id: "1", value: "foo" },
  { id: "2", value: "bar" },
  { id: "3", value: "baz" },
];

const initCore = async (dbName = "persistent-test") => {
  const coreOptions = {
    ...TEST_CORE_OPTIONS,
    storageOptions: { database: `tmp/${dbName}.db` },
  };
  core = new Core(coreOptions);
  await core.start();
};

const initStore = async () => {
  store = new Store<string, MockValue>(
    core,
    logger,
    MOCK_STORE_NAME,
    undefined,
    (val) => val.value,
  );
  await store.init();
  storeTestValues.forEach((val) => store.set(val.id, val));
};

/**
 *  Prevents gross code duplication in tests that require restarting core
 * @param fx function to run before each restart
 * @param fy function to run after each restart
 */
const restartCore = async (fx?: () => Promise<void>, fy?: () => Promise<void>) => {
  for (let i = 0; i < n_restarts; i++) {
    if (fx) await fx();
    await initCore();
    if (fy) await fy();
  }
};

/**
 * Search for a topic in a list of records
 * @param records
 * @param topic
 * @returns true if topic is found, false otherwise
 */
const searchRecords = (records: any, topic: string) => {
  for (const [_, record] of records.entries()) {
    if (record.topic === topic) return true;
  }
  return false;
};

describe("Persistence", () => {
  beforeEach(async () => {
    await initCore();
  });

  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  it("should persist store values across restarts", async () => {
    await initStore();
    await restartCore();
    expect(store.getAll()).to.toMatchObject(storeTestValues);
  });

  it("should persist store values of PAIRS across restarts", async () => {
    // --- setup ---
    const coreA = core; // allias for clarity
    const coreB = new Core(TEST_CORE_OPTIONS);
    await coreB.start();

    // --- fx routine ---
    const fx = undefined; // no fx needed

    // --- fy routine ---
    const fy = async () => {
      const { uri, topic } = await coreA.pairing.create();
      let hasDeleted = false;
      coreA.pairing.events.on("pairing_delete", () => {
        hasDeleted = true;
      });

      await coreB.pairing.pair({ uri });

      // pairing was created
      expect(coreA.pairing.pairings.keys.length).toBe(1);
      expect(coreB.pairing.pairings.keys.length).toBe(1);

      // topic does not exist in history
      expect(searchRecords(coreA.history.records, topic)).toBe(false);
      expect(searchRecords(coreB.history.records, topic)).toBe(false);

      // ensure that keychain is updated
      expect(coreA.crypto.keychain.keychain.has(topic)).toBe(true);
      expect(coreB.crypto.keychain.keychain.has(topic)).toBe(true);

      // ensure that expiry is updated
      expect(coreA.expirer.values.length).toBe(1);
      expect(coreB.expirer.values.length).toBe(1);

      await coreB.pairing.disconnect({ topic });

      await throttle(5000); // wait for pairing_delete event to fire
      expect(hasDeleted).toBe(true);

      // pairing was deleted
      expect(coreA.pairing.pairings.keys.length).toBe(0);
      expect(coreB.pairing.pairings.keys.length).toBe(0);

      // topic was added to history
      expect(searchRecords(coreA.history.records, topic)).toBe(true);
      expect(searchRecords(coreB.history.records, topic)).toBe(true);

      // keychain was updated
      expect(coreA.crypto.keychain.keychain.has(topic)).toBe(false);
      expect(coreB.crypto.keychain.keychain.has(topic)).toBe(false);

      // ensure that expiry is updated
      expect(coreA.expirer.values.length).toBe(0);
      expect(coreB.expirer.values.length).toBe(0);
    };

    // start routine
    await restartCore(fx, fy);

    // final check of pairings
    expect(coreA.pairing.getPairings()).to.deep.equal(coreB.pairing.getPairings());
  });

  it("should persist store values of SESSIONS across restarts", async () => {
    // --- setup ---
    const subscriber = core.relayer.subscriber;
    const datashare = { topic: generateRandomBytes32() };

    // --- fx routine ---
    const fx = async () => {
      const topic = generateRandomBytes32();
      await subscriber.subscribe(topic);
      datashare.topic = topic;
    };

    // --- fy routine ---
    const fy = async () => {
      // check that the session, topic were restored
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics).to.contain(datashare.topic);

      await subscriber.unsubscribe(datashare.topic);

      // check that the session, topic were cleared correctly
      expect(subscriber.subscriptions.size).to.equal(0);
      expect(subscriber.topics.length).to.equal(0);
    };

    // start routine
    await restartCore(fx, fy);
  });
});
