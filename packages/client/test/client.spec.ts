import "mocha";
// import { expect } from "chai";

import Client from "../src";

import { expect, initTwoClients, testConnectMethod, TEST_CLIENT_OPTIONS } from "./shared";

describe("Client", () => {
  it("init", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect (with new pairing)", async () => {
    const clients = await initTwoClients();
    await testConnectMethod(clients);
  });
  it("connect (with old pairing)", async () => {
    const clients = await initTwoClients();
    await testConnectMethod(clients);
    const { A, B } = clients;
    expect(A.pairing.keys).to.eql(B.pairing.keys);
    const { topic: pairingTopic } = await A.pairing.get(A.pairing.keys[0]);
    await testConnectMethod(clients, {
      pairingTopic,
      chains: [],
      events: [],
      methods: [],
      accounts: [],
    });
  });
});
