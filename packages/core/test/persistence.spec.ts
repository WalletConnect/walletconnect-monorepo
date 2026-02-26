import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { ICore, IStore } from "@walletconnect/types";
import {
  MockStoreValue,
  TEST_CORE_OPTIONS,
  disconnectSocket,
  initCore,
  initStore,
  restartCore,
  searchRecords,
  storeTestValues,
  waitForEvent,
} from "./shared";
import { Core } from "../src";
import { generateRandomBytes32 } from "@walletconnect/utils";

describe("Persistence", () => {
  let core: ICore;
  let store: IStore<string, MockStoreValue>;

  beforeEach(async () => {
    core = await initCore();
  });

  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  it("should persist store values across restarts", async () => {
    store = await initStore(core);
    await restartCore();
    expect(store.getAll()).to.toMatchObject(storeTestValues);
  });

  it("should persist store values of PAIRINGS across restarts", async () => {
    // --- setup ---
    const coreA = core; // alias for clarity
    const coreB = new Core(TEST_CORE_OPTIONS);
    await coreB.start();

    // --- after restart routine ---
    const afterRestart = async () => {
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

      await waitForEvent(() => hasDeleted);

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
    await restartCore(undefined, afterRestart);

    // final check of pairings
    expect(coreA.pairing.getPairings()).to.deep.equal(coreB.pairing.getPairings());
  });

  it("should persist store values of SESSIONS across restarts", async () => {
    // --- setup ---
    const subscriber = core.relayer.subscriber;
    const datashare = { topic: generateRandomBytes32() };

    // --- before core restarts routine ---
    const beforeRestart = async () => {
      const topic = generateRandomBytes32();
      await subscriber.subscribe(topic);
      datashare.topic = topic;
    };

    // --- after core restarts routine ---
    const afterRestart = async () => {
      // check that the session, topic were restored
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics).to.contain(datashare.topic);

      await subscriber.unsubscribe(datashare.topic);

      // check that the session, topic were cleared correctly
      expect(subscriber.subscriptions.size).to.equal(0);
      expect(subscriber.topics.length).to.equal(0);
    };

    // start routine
    await restartCore(beforeRestart, afterRestart);
  });
});
