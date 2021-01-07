import "mocha";
import { expect } from "chai";

import Client from "../src";

import {
  TEST_CLIENT_OPTIONS,
  testRequestScenarios,
  setupClientsForTesting,
  testApproveSession,
} from "./shared";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("full flow stanity test", async () => {
    // test session scenario & get clients
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const result = await testRequestScenarios({ topic, clients });
    expect(!!result).to.be.true;
  });
});
