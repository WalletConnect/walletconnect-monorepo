// @ts-nocheck
import "mocha";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_APPROVE_PARAMS,
  TEST_CONNECT_PARAMS,
  TEST_REJECT_PARAMS,
  TEST_UPDATE_ACCOUNTS_PARAMS,
  TEST_UPDATE_EXPIRY_PARAMS,
} from "./shared";
import Client from "../src";

let client: Client;
let pairingTopic: string;
let topic: string;

describe("Client Validation", () => {
  before(async () => {
    const clients = await initTwoClients();
    await testConnectMethod(clients);
    client = clients.A;
    pairingTopic = client.pairing.keys[0];
    topic = client.session.keys[0];
  });

  describe("connect", () => {
    it("throws when no params are passed", async () => {
      await expect(client.connect()).to.eventually.be.rejectedWith(
        "Missing or invalid connect params",
      );
    });

    it("throws when invalid pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid connect pairingTopic");
    });

    it("throws when empty pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid connect pairingTopic");
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

    it("throws when no uri is provided", async () => {
      await expect(client.pair({ uri: undefined })).to.eventually.be.rejectedWith(
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

    it("throws when no id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: undefined }),
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

    it("throws when no accounts are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, accounts: undefined }),
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

    it("throws when no namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, namespaces: undefined }),
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

  describe("reject", () => {
    it("throws when no params are passed", async () => {
      await expect(client.reject()).to.eventually.be.rejectedWith(
        "Missing or invalid reject params",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: "123" }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject id");
    });

    it("throws when empty id is provided", async () => {
      await expect(client.reject({ ...TEST_REJECT_PARAMS, id: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid reject id",
      );
    });

    it("throws when no id is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject id");
    });

    it("throws when empty reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, reason: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when invalid reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, reason: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when no reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, reason: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when invalid reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, code: "1" },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when empty reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, code: "" },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when no reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, code: undefined },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when invalid reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, message: 123 },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when empty reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, message: "" },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });

    it("throws when no reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          reason: { ...TEST_REJECT_PARAMS.reason, message: undefined },
        }),
      ).to.eventually.be.rejectedWith("Missing or invalid reject reason");
    });
  });

  describe("updateAccounts", () => {
    it("throws when no params are passed", async () => {
      await expect(client.updateAccounts()).to.eventually.be.rejectedWith(
        "Missing or invalid updateAccounts params",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(
        client.updateAccounts({ ...TEST_UPDATE_ACCOUNTS_PARAMS, topic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateAccounts topic");
    });

    it("throws when empty topic is provided", async () => {
      await expect(
        client.updateAccounts({ ...TEST_UPDATE_ACCOUNTS_PARAMS, topic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateAccounts topic");
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.updateAccounts({ ...TEST_UPDATE_ACCOUNTS_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateAccounts topic");
    });

    it("throws when non existant topic is provided", async () => {
      await expect(
        client.updateAccounts({ ...TEST_UPDATE_ACCOUNTS_PARAMS, topic: "none" }),
      ).to.eventually.be.rejectedWith("No matching session with topic: none");
    });

    it("throws when invalid accounts are provided", async () => {
      await expect(client.updateAccounts({ topic, accounts: [123] })).to.eventually.be.rejectedWith(
        "Missing or invalid updateAccounts accounts",
      );
      await expect(
        client.updateAccounts({ topic, accounts: ["123"] }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateAccounts accounts");
    });

    it("throws when no accounts are provided", async () => {
      await expect(
        client.updateAccounts({ topic, accounts: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateAccounts accounts");
    });

    it("throws when provided accounts are not in session namespace", async () => {
      await expect(
        client.updateAccounts({
          topic,
          accounts: [
            "eip155:42:0x3c582121909DE92Dc89A36898633C1aE4790382b",
            "eip155:10:0x3c582121909DE92Dc89A36898633C1aE4790382b",
          ],
        }),
      ).to.eventually.be.rejectedWith(
        "Invalid accounts with mismatched chains: eip155:42,eip155:10",
      );
    });
  });

  describe("updateNamespaces", () => {
    // TODO
  });

  describe("updateExpiry", () => {
    it("throws when no params are passed", async () => {
      await expect(client.updateExpiry()).to.eventually.be.rejectedWith(
        "Missing or invalid updateExpiry params",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(
        client.updateExpiry({ ...TEST_UPDATE_EXPIRY_PARAMS, topic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateExpiry topic");
    });

    it("throws when empty topic is provided", async () => {
      await expect(
        client.updateExpiry({ ...TEST_UPDATE_EXPIRY_PARAMS, topic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateExpiry topic");
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.updateExpiry({ ...TEST_UPDATE_EXPIRY_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid updateExpiry topic");
    });

    it("throws when non existant topic is provided", async () => {
      await expect(
        client.updateExpiry({ ...TEST_UPDATE_EXPIRY_PARAMS, topic: "none" }),
      ).to.eventually.be.rejectedWith("No matching session with topic: none");
    });
  });
});
