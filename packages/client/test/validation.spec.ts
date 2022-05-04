// @ts-nocheck
import "mocha";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_APPROVE_PARAMS,
  TEST_CONNECT_PARAMS,
} from "./shared";
import Client from "../src";

let client: Client;
let pairingTopic: string;

describe("Client Validation", () => {
  before(async () => {
    const clients = await initTwoClients();
    await testConnectMethod(clients);
    client = clients.A;
    pairingTopic = client.pairing.keys[0];
  });

  describe("connect", () => {
    it("throws when no params are passed", async () => {
      await expect(client.connect()).to.eventually.be.rejectedWith(
        "Missing or invalid connect params",
      );
    });

    it("throws when non existant pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "none" }),
      ).to.eventually.be.rejectedWith("No matching pairing with topic: none");
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, namespaces: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid connect namespaces");
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, namespaces: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid connect namespaces");
    });
  });

  describe("pair", () => {
    it("throws when no params are passed", async () => {
      await expect(client.pair()).to.eventually.be.rejectedWith("Missing or invalid pair params");
    });

    it("throws when empty uri is provided", async () => {
      await expect(client.pair({ uri: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid pair uri",
      );
    });

    it("throws when invalid uri is provided", async () => {
      await expect(client.pair({ uri: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid pair uri",
      );
    });
  });

  describe("approve", () => {
    it("throws when no params are passed", async () => {
      await expect(client.approve()).to.eventually.be.rejectedWith(
        "Missing or invalid approve params",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: "123" }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve id");
    });

    it("throws when empty id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve id");
    });

    it("throws when invalid accounts are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, accounts: [123] }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve accounts");
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, accounts: ["123"] }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve accounts");
    });

    it("throws when empty accounts are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, accounts: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve accounts");
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, namespaces: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve namespaces");
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, namespaces: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve namespaces");
    });

    it("throws when invalid relayProtocol are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, relayProtocol: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve relayProtocol");
    });

    it("throws when empty relayProtocol is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, relayProtocol: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid approve relayProtocol");
    });
  });
});
