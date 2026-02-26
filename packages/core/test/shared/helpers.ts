import { getDefaultLoggerOptions, generateClientLogger } from "@walletconnect/logger";
import { CoreTypes, ICore } from "@walletconnect/types";
import { DEFAULT_DB_NAME, MOCK_STORE_NAME, TEST_CORE_OPTIONS, storeTestValues } from "./values";
import { Core, Store } from "../../src";

export type MockStoreValue = { id: string; value: string };

export async function throttle(timeout: number) {
  return await new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, timeout),
  );
}

/**
 * Initializes a core instance with default options
 * Default uses custom db to isolate persistence tests
 * @param customOpts = custom core init opts
 * @returns Initialized core instance
 */
export const initCore = async (
  customOpts: CoreTypes.Options = { storageOptions: { database: DEFAULT_DB_NAME } },
) => {
  const coreOptions = {
    ...TEST_CORE_OPTIONS,
    ...customOpts,
  };
  const core = new Core(coreOptions);
  await core.start();
  return core;
};

/**
 * Initializes a store instance with default options
 * @param core = core to use for store
 * @returns Initialized store instance
 */
export const initStore = async (core: ICore) => {
  const logger = generateClientLogger({
    opts: getDefaultLoggerOptions({ level: "fatal" }),
  }).logger;

  const store = new Store<string, MockStoreValue>(
    core,
    logger,
    MOCK_STORE_NAME,
    undefined,
    (val) => val.value,
  );
  await store.init();
  storeTestValues.forEach((val) => store.set(val.id, val));
  return store;
};

/**
 * Prevents gross code duplication in tests that require restarting core
 * @param beforeRestart function to run before each restart
 * @param afterRestart function to run after each restart
 * @param n_restarts number of times to restart core
 * @param customOpts custom core options
 */
export const restartCore = async (
  beforeRestart?: () => Promise<void>,
  afterRestart?: () => Promise<void>,
  n_restarts = 1,
  customOpts = { storageOptions: { database: DEFAULT_DB_NAME } },
) => {
  for (let i = 0; i < n_restarts; i++) {
    if (beforeRestart) await beforeRestart();
    await initCore(customOpts);
    if (afterRestart) await afterRestart();
  }
};

/**
 * Search for a topic in a list of records
 * @param records
 * @param topic
 * @returns true if topic is found, false otherwise
 */
export const searchRecords = (records: any, topic: string) => {
  for (const [_, record] of records.entries()) {
    if (record.topic === topic) return true;
  }
  return false;
};

export const waitForEvent = async (checkForEvent: (...args: any[]) => boolean) => {
  await new Promise((resolve) => {
    const intervalId = setInterval(() => {
      if (checkForEvent()) {
        clearInterval(intervalId);
        resolve({});
      }
    }, 100);
  });
};
