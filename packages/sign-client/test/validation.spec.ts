// @ts-nocheck
import "mocha";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_APPROVE_PARAMS,
  TEST_CONNECT_PARAMS,
  TEST_REJECT_PARAMS,
  TEST_UPDATE_PARAMS,
  TEST_REQUEST_PARAMS,
  TEST_EMIT_PARAMS,
  TEST_RESPOND_PARAMS,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_NAMESPACES_INVALID_METHODS,
  TEST_NAMESPACES_INVALID_CHAIN,
} from "./shared";
import SignClient from "../src";

let client: SignClient;
let proposalId: number;
let pairingTopic: string;
let topic: string;

describe("Sign Client Validation", () => {
  before(async () => {
    const clients = await initTwoClients();
    await testConnectMethod(clients);
    client = clients.A;
    pairingTopic = client.pairing.keys[0];
    proposalId = client.proposal.keys[0];
    topic = client.session.keys[0];
  });

  describe("connect", () => {
    it("throws when no params are passed", async () => {
      await expect(client.connect()).to.eventually.be.rejectedWith(
        "Missing or invalid. connect() params: undefined",
      );
    });

    it("throws when invalid pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. pairing topic should be a string: 123");
    });

    it("throws when empty pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. pairing topic should be a string: ");
    });

    it("throws when non existant pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "none" }),
      ).to.eventually.be.rejectedWith("No matching key. pairing topic doesn't exist: none");
    });

    it("throws when empty requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: {} }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when invalid requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: [] }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when no requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when empty extension is provided", async () => {
      const requiredNamespaces = { eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [] } };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. connect() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when empty extension body is provided", async () => {
      const requiredNamespaces = {
        eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [{}] },
      };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).to.eventually.be.rejectedWith(
        `Unsupported chains. connect() extension, chains undefined should be an array of strings conforming to "namespace:chainId" format`,
      );
    });

    it("throws when invalid extension is provided", async () => {
      const requiredNamespaces = { eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: {} } };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. connect() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when invalid extension values are provided", async () => {
      const requiredNamespaces = {
        eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [{ invalid: [""] }] },
      };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).to.eventually.be.rejectedWith(
        `Unsupported chains. connect() extension, chains undefined should be an array of strings conforming to "namespace:chainId" format`,
      );
    });
  });

  describe("pair", () => {
    it("throws when no params are passed", async () => {
      await expect(client.pair()).to.eventually.be.rejectedWith(
        "Missing or invalid. pair() params: undefined",
      );
    });

    it("throws when empty uri is provided", async () => {
      await expect(client.pair({ uri: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. pair() uri: ",
      );
    });

    it("throws when invalid uri is provided", async () => {
      await expect(client.pair({ uri: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid. pair() uri: 123",
      );
    });

    it("throws when no uri is provided", async () => {
      await expect(client.pair({ uri: undefined })).to.eventually.be.rejectedWith(
        "Missing or invalid. pair() uri: undefined",
      );
    });
  });

  describe("approve", () => {
    it("throws when no params are passed", async () => {
      await expect(client.approve()).to.eventually.be.rejectedWith(
        "Missing or invalid. approve() params: undefined",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: "123" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. proposal id should be a number: 123");
    });

    it("throws when empty id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. proposal id should be a number: ");
    });

    it("throws when no id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. proposal id should be a number: undefined",
      );
    });

    it("throws when non existant id is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: 123 }),
      ).to.eventually.be.rejectedWith("No matching key. proposal id doesn't exist: 123");
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: [] }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: {} }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when no namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when empty extension is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. approve() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when empty extension body is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [{}] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).to.eventually.be.rejectedWith(
        `Unsupported accounts. approve() extension, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
      );
    });

    it("throws when invalid extension is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: {} } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. approve() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when invalid extension values are provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [{ invalid: [""] }] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).to.eventually.be.rejectedWith(
        `Unsupported accounts. approve() extension, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
      );
    });

    it("throws when invalid relayProtocol is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, relayProtocol: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. approve() relayProtocol: 123");
    });

    it("throws when empty relayProtocol is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, relayProtocol: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. approve() relayProtocol: ");
    });
  });

  describe("reject", () => {
    it("throws when no params are passed", async () => {
      await expect(client.reject()).to.eventually.be.rejectedWith(
        "Missing or invalid. reject() params: undefined",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: "123" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. proposal id should be a number: 123");
    });

    it("throws when empty id is provided", async () => {
      await expect(client.reject({ ...TEST_REJECT_PARAMS, id: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. proposal id should be a number: ",
      );
    });

    it("throws when no id is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. proposal id should be a number: undefined",
      );
    });

    it("throws when empty reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid. reject() reason: {}");
    });

    it("throws when invalid reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid. reject() reason: []");
    });

    // FIXME: this test should fail since this PR now allows reason to be undefined
    it("throws when no reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid. reject() reason: undefined");
    });

    it("throws when invalid reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, code: "1" },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. reject() reason: {"code":"1","message":"GENERIC"}`,
      );
    });

    it("throws when empty reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, code: "" },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. reject() reason: {"code":"","message":"GENERIC"}`,
      );
    });

    it("throws when no reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, code: undefined },
        }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. reject() reason: {"message":"GENERIC"}`);
    });

    it("throws when invalid reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: 123 },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. reject() reason: {"code":0,"message":123}`,
      );
    });

    it("throws when empty reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: "" },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. reject() reason: {"code":0,"message":""}`,
      );
    });

    it("throws when no reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: undefined },
        }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. reject() reason: {"code":0}`);
    });
  });

  describe("update", () => {
    it("throws when no params are passed", async () => {
      await expect(client.update()).to.eventually.be.rejectedWith(
        "Missing or invalid. update() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(
        client.update({ ...TEST_UPDATE_PARAMS, topic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: 123");
    });

    it("throws when empty topic is provided", async () => {
      await expect(
        client.update({ ...TEST_UPDATE_PARAMS, topic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: ");
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.update({ ...TEST_UPDATE_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(
        client.update({ ...TEST_UPDATE_PARAMS, topic: "none" }),
      ).to.eventually.be.rejectedWith("No matching key. session topic doesn't exist: none");
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: {} })).to.eventually.be.rejectedWith(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: [] })).to.eventually.be.rejectedWith(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when no namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: undefined })).to.eventually.be.rejectedWith(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when incompatible namespaces methods are provided", async () => {
      await expect(
        client.update({
          topic,
          namespaces: TEST_NAMESPACES_INVALID_METHODS,
        }),
      ).to.eventually.be.rejectedWith(
        "Non conforming namespaces. update() namespaces methods don't satisfy requiredNamespaces methods for eip155",
      );
    });

    it("throws when incompatible namespaces chains are provided", async () => {
      await expect(
        client.update({
          topic,
          namespaces: TEST_NAMESPACES_INVALID_CHAIN,
        }),
      ).to.eventually.be.rejectedWith(
        "Non conforming namespaces. update() namespaces keys don't satisfy requiredNamespaces",
      );
    });
  });

  describe("extend", () => {
    it("throws when no params are passed", async () => {
      await expect(client.extend()).to.eventually.be.rejectedWith(
        "Missing or invalid. extend() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.extend({ topic: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.extend({ topic: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.extend({ topic: undefined })).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.extend({ topic: "none" })).to.eventually.be.rejectedWith(
        "No matching key. session topic doesn't exist: none",
      );
    });
  });

  describe("request", () => {
    it("throws when no params are passed", async () => {
      await expect(client.request()).to.eventually.be.rejectedWith(
        "Missing or invalid. request() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: 123");
    });

    it("throws when empty topic is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: ");
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic: "none" }),
      ).to.eventually.be.rejectedWith("No matching key. session topic doesn't exist: none");
    });

    it("throws when invalid chainId is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() chainId: 123");
    });

    it("throws when empty chainId is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() chainId: ");
    });

    it("throws when chain id is not in session namespace", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: "eip000:0" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() chainId: eip000:0");
    });

    it("throws when invalid request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() 123");
    });

    it("throws when empty request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() {}");
    });

    it("throws when no request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() undefined");
    });

    it("throws when invalid request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: 123 } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. request() {"method":123}`);
    });

    it("throws when empty request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: "" } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. request() {"method":""}`);
    });

    it("throws when no request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: undefined } }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() {}");
    });

    it("throws when request doesn't exist for given chainId", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: "unknown" } }),
      ).to.eventually.be.rejectedWith("Missing or invalid. request() method: unknown");
    });
  });

  describe("respond", () => {
    it("throws when no params are passed", async () => {
      await expect(client.respond()).to.eventually.be.rejectedWith(
        "Missing or invalid. respond() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(
        client.respond({ ...TEST_REQUEST_PARAMS, topic: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: 123");
    });

    it("throws when empty topic is provided", async () => {
      await expect(
        client.respond({ ...TEST_RESPOND_PARAMS, topic: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. session topic should be a string: ");
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.respond({ ...TEST_RESPOND_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when no response or error is passed", async () => {
      await expect(
        client.respond({ ...TEST_RESPOND_PARAMS, topic, response: undefined, error: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid. respond() response: undefined");
    });

    it("throws when no id is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, id: undefined },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. respond() response: {"jsonrpc":"2.0","result":{}}`,
      );
    });

    it("throws when invalid id is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, id: "123" },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. respond() response: {"id":"123","jsonrpc":"2.0","result":{}}`,
      );
    });

    it("throws when no jsonrpc is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, jsonrpc: undefined },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. respond() response: {"id":1,"result":{}}`,
      );
    });

    it("throws when invalid jsonrpc is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, jsonrpc: 123 },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. respond() response: {"id":1,"jsonrpc":123,"result":{}}`,
      );
    });

    it("throws when empty jsonrpc is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, jsonrpc: "" },
        }),
      ).to.eventually.be.rejectedWith(
        `Missing or invalid. respond() response: {"id":1,"jsonrpc":"","result":{}}`,
      );
    });
  });

  describe("ping", () => {
    it("throws when no params are passed", async () => {
      await expect(client.ping()).to.eventually.be.rejectedWith(
        "Missing or invalid. ping() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.ping({ topic: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.ping({ topic: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.ping({ topic: undefined })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.ping({ topic: "none" })).to.eventually.be.rejectedWith(
        "No matching key. session or pairing topic doesn't exist: none",
      );
    });
  });

  describe("emit", () => {
    it("throws when no params are passed", async () => {
      await expect(client.emit()).to.eventually.be.rejectedWith(
        "Missing or invalid. emit() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic: undefined }),
      ).to.eventually.be.rejectedWith(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic: "none" }),
      ).to.eventually.be.rejectedWith("No matching key. session topic doesn't exist: none");
    });

    it("throws when invalid chainId is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, chainId: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. emit() chainId: 123");
    });

    it("throws when empty chainId is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, chainId: "" }),
      ).to.eventually.be.rejectedWith("Missing or invalid. emit() chainId: ");
    });

    it("throws when invalid event is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: 123 }),
      ).to.eventually.be.rejectedWith("Missing or invalid. emit() event: 123");
    });

    it("throws when empty event is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid. emit() event: {}");
    });

    it("throws when no event is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: undefined }),
      ).to.eventually.be.rejectedWith("Missing or invalid. emit() event: undefined");
    });

    it("throws when invalid event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: 123 } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. emit() event: {"name":123}`);
    });

    it("throws when empty event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: "" } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. emit() event: {"name":""}`);
    });

    it("throws when no event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: undefined } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. emit() event: {}`);
    });

    it("throws when event doesn't exist for given chainId", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: "unknown" } }),
      ).to.eventually.be.rejectedWith(`Missing or invalid. emit() event: {"name":"unknown"}`);
    });
  });

  describe("disconnect", () => {
    it("throws when no params are passed", async () => {
      await expect(client.disconnect()).to.eventually.be.rejectedWith(
        "Missing or invalid. disconnect() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.disconnect({ topic: 123 })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.disconnect({ topic: "" })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.disconnect({ topic: undefined })).to.eventually.be.rejectedWith(
        "Missing or invalid. session or pairing topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.disconnect({ topic: "none" })).to.eventually.be.rejectedWith(
        "No matching key. session or pairing topic doesn't exist: none",
      );
    });
  });
});
