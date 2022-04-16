import { ClientTypes } from "@walletconnect/types";

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

export const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID
  ? process.env.TEST_PROJECT_ID
  : undefined;

export const TEST_CLIENT_OPTIONS: ClientTypes.Options = {
  logger: "fatal",
  relayUrl: TEST_RELAY_URL,
  projectId: TEST_PROJECT_ID,
};
