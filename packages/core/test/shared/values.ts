import { CoreTypes } from "@walletconnect/types";

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://0.0.0.0:5555";

export const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID
  ? process.env.TEST_PROJECT_ID
  : undefined;

export const TEST_PROJECT_ID_MOBILE = process.env.TEST_PROJECT_ID_MOBILE
  ? process.env.TEST_PROJECT_ID_MOBILE
  : undefined;

export const TEST_CORE_OPTIONS: CoreTypes.Options = {
  logger: "fatal",
  relayUrl: TEST_RELAY_URL,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
};

export const TEST_MOBILE_APP_ID = process.env.TEST_MOBILE_APP_ID
  ? process.env.TEST_MOBILE_APP_ID
  : undefined;

// default db name for persistent storage tests
export const DEFAULT_DB_NAME = "./test/tmp/persistent-test.db";

// default store name for persistent storage tests
export const MOCK_STORE_NAME = "persistent-store";

// default test values for persistent storage tests
export const storeTestValues = [
  { id: "1", value: "foo" },
  { id: "2", value: "bar" },
  { id: "3", value: "baz" },
];
