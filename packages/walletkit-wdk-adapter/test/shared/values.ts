import { CoreTypes } from "@walletconnect/types";

export const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || "";
export const TEST_RELAY_URL = process.env.TEST_RELAY_URL || "";

export const TEST_METADATA: CoreTypes.Metadata = {
  name: "walletkit-wdk-adapter-test",
  description: "test description",
  url: "https://walletconnect.com",
  icons: ["https://walletconnect.com/icon.png"],
};

export const TEST_ADAPTER_OPTIONS = {
  projectId: TEST_PROJECT_ID,
  metadata: TEST_METADATA,
};
