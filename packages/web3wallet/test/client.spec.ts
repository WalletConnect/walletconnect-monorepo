import { Core } from "@walletconnect/core";
import { expect, describe, it } from "vitest";
import { Web3Wallet } from "../src";

const TEST_CORE_OPTIONS = {
  projectId: process.env.TEST_PROJECT_ID,
  logger: "debug",
  relayUrl: process.env.TEST_RELAY_URL,
};

describe("Web3Wallet Integration", () => {
  it("init", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    const client = await Web3Wallet.init({ core });
    expect(client).to.be.exist;
    console.log(client);
  });
});
