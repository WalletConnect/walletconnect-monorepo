import "mocha";
import { expect } from "chai";

import Client from "../src";

import { TEST_CLIENT_OPTIONS } from "./shared";
import { testSessionScenarios } from "./shared/session";
import { testRequestScenarios } from "./shared/request";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect two clients and resolve a JSON-RPC request", async () => {
    // test session scenario & get clients
    const { topic, clients } = await testSessionScenarios();
    const result = await testRequestScenarios({ topic, clients });
    expect(!!result).to.be.true;
  });
});
