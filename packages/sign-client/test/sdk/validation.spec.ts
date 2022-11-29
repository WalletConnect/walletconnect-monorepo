// @ts-nocheck
import { expect, describe, it, beforeAll, afterAll } from "vitest";
import {
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
  deleteClients,
  Clients,
} from "../shared";
import SignClient from "../../src";

let client: SignClient;
let proposalId: number;
let pairingTopic: string;
let topic: string;

describe("Sign Client Validation", async () => {
  // let clients: Clients;
  // beforeAll(async () => {
  const clients = await initTwoClients();
  await testConnectMethod(clients);
  client = clients.A;
  pairingTopic = client.pairing.keys[0];
  proposalId = client.proposal.keys[0];
  topic = client.session.keys[0];
  // // });

  // afterAll(async () => {
  //   await deleteClients(clients);
  // });

  describe("connect", () => {
    it("throws when no params are passed", async () => {
      await expect(client.connect()).rejects.toThrowError(
        "Missing or invalid. connect() params: undefined",
      );
    });

    it("throws when invalid pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: 123 }),
      ).rejects.toThrowError("Missing or invalid. pairing topic should be a string: 123");
    });

    it("throws when empty pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "" }),
      ).rejects.toThrowError("Missing or invalid. pairing topic should be a string: ");
    });

    it("throws when non existant pairingTopic is provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "none" }),
      ).rejects.toThrowError("No matching key. pairing topic doesn't exist: none");
    });

    it("throws when empty requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: {} }),
      ).rejects.toThrowError(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when invalid requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: [] }),
      ).rejects.toThrowError(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when no requiredNamespaces are provided", async () => {
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces: undefined }),
      ).rejects.toThrowError(
        "Missing or invalid. connect(), requiredNamespaces should be an object with data",
      );
    });

    it("throws when empty extension is provided", async () => {
      const requiredNamespaces = { eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [] } };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).rejects.toThrowError(
        "Missing or invalid. connect() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when empty extension body is provided", async () => {
      const requiredNamespaces = {
        eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [{}] },
      };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).rejects.toThrowError(
        `Unsupported chains. connect() extension, chains undefined should be an array of strings conforming to "namespace:chainId" format`,
      );
    });

    it("throws when invalid extension is provided", async () => {
      const requiredNamespaces = { eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: {} } };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).rejects.toThrowError(
        "Missing or invalid. connect() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when invalid extension values are provided", async () => {
      const requiredNamespaces = {
        eip155: { ...TEST_REQUIRED_NAMESPACES.eip155, extension: [{ invalid: [""] }] },
      };
      await expect(
        client.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, requiredNamespaces }),
      ).rejects.toThrowError(
        `Unsupported chains. connect() extension, chains undefined should be an array of strings conforming to "namespace:chainId" format`,
      );
    });
  });

  describe("approve", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.approve()).rejects.toThrowError(
        "Missing or invalid. approve() params: undefined",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(client.approve({ ...TEST_APPROVE_PARAMS, id: "123" })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: 123",
      );
    });

    it("throws when empty id is provided", async () => {
      await expect(client.approve({ ...TEST_APPROVE_PARAMS, id: "" })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: ",
      );
    });

    it("throws when no id is provided", async () => {
      await expect(client.approve({ ...TEST_APPROVE_PARAMS, id: undefined })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: undefined",
      );
    });

    it("throws when non existant id is provided", async () => {
      await expect(client.approve({ ...TEST_APPROVE_PARAMS, id: 123 })).rejects.toThrowError(
        "No matching key. proposal id doesn't exist: 123",
      );
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: [] }),
      ).rejects.toThrowError(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: {} }),
      ).rejects.toThrowError(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when no namespaces are provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces: undefined }),
      ).rejects.toThrowError(
        "Missing or invalid. approve(), namespaces should be an object with data",
      );
    });

    it("throws when empty extension is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).rejects.toThrowError(
        "Missing or invalid. approve() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when empty extension body is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [{}] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).rejects.toThrowError(
        `Unsupported accounts. approve() extension, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
      );
    });

    it("throws when invalid extension is provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: {} } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).rejects.toThrowError(
        "Missing or invalid. approve() extension should be an array of namespaces, or omitted",
      );
    });

    it("throws when invalid extension values are provided", async () => {
      const namespaces = { eip155: { ...TEST_NAMESPACES.eip155, extension: [{ invalid: [""] }] } };
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, namespaces }),
      ).rejects.toThrowError(
        `Unsupported accounts. approve() extension, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
      );
    });

    it("throws when invalid relayProtocol is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, relayProtocol: 123 }),
      ).rejects.toThrowError("Missing or invalid. approve() relayProtocol: 123");
    });

    it("throws when empty relayProtocol is provided", async () => {
      await expect(
        client.approve({ ...TEST_APPROVE_PARAMS, id: proposalId, relayProtocol: "" }),
      ).rejects.toThrowError("Missing or invalid. approve() relayProtocol: ");
    });
  });

  describe("reject", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.reject()).rejects.toThrowError(
        "Missing or invalid. reject() params: undefined",
      );
    });

    it("throws when invalid id is provided", async () => {
      await expect(client.reject({ ...TEST_REJECT_PARAMS, id: "123" })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: 123",
      );
    });

    it("throws when empty id is provided", async () => {
      await expect(client.reject({ ...TEST_REJECT_PARAMS, id: "" })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: ",
      );
    });

    it("throws when no id is provided", async () => {
      await expect(client.reject({ ...TEST_REJECT_PARAMS, id: undefined })).rejects.toThrowError(
        "Missing or invalid. proposal id should be a number: undefined",
      );
    });

    it("throws when empty reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: {} }),
      ).rejects.toThrowError("Missing or invalid. reject() reason: {}");
    });

    it("throws when invalid reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: [] }),
      ).rejects.toThrowError("Missing or invalid. reject() reason: []");
    });

    it("throws when no reason is provided", async () => {
      await expect(
        client.reject({ ...TEST_REJECT_PARAMS, id: proposalId, reason: undefined }),
      ).rejects.toThrowError("Missing or invalid. reject() reason: undefined");
    });

    it("throws when invalid reason code is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, code: "1" },
        }),
      ).rejects.toThrowError(
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
      ).rejects.toThrowError(
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
      ).rejects.toThrowError(`Missing or invalid. reject() reason: {"message":"GENERIC"}`);
    });

    it("throws when invalid reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: 123 },
        }),
      ).rejects.toThrowError(`Missing or invalid. reject() reason: {"code":0,"message":123}`);
    });

    it("throws when empty reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: "" },
        }),
      ).rejects.toThrowError(`Missing or invalid. reject() reason: {"code":0,"message":""}`);
    });

    it("throws when no reason message is provided", async () => {
      await expect(
        client.reject({
          ...TEST_REJECT_PARAMS,
          id: proposalId,
          reason: { ...TEST_REJECT_PARAMS.reason, message: undefined },
        }),
      ).rejects.toThrowError(`Missing or invalid. reject() reason: {"code":0}`);
    });
  });

  describe("update", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.update()).rejects.toThrowError(
        "Missing or invalid. update() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.update({ ...TEST_UPDATE_PARAMS, topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.update({ ...TEST_UPDATE_PARAMS, topic: "" })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.update({ ...TEST_UPDATE_PARAMS, topic: undefined })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.update({ ...TEST_UPDATE_PARAMS, topic: "none" })).rejects.toThrowError(
        "No matching key. session topic doesn't exist: none",
      );
    });

    it("throws when invalid namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: {} })).rejects.toThrowError(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when empty namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: [] })).rejects.toThrowError(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when no namespaces are provided", async () => {
      await expect(client.update({ topic, namespaces: undefined })).rejects.toThrowError(
        "Missing or invalid. update(), namespaces should be an object with data",
      );
    });

    it("throws when incompatible namespaces methods are provided", async () => {
      await expect(
        client.update({
          topic,
          namespaces: TEST_NAMESPACES_INVALID_METHODS,
        }),
      ).rejects.toThrowError(
        "Non conforming namespaces. update() namespaces methods don't satisfy requiredNamespaces methods for eip155",
      );
    });

    it("throws when incompatible namespaces chains are provided", async () => {
      await expect(
        client.update({
          topic,
          namespaces: TEST_NAMESPACES_INVALID_CHAIN,
        }),
      ).rejects.toThrowError(
        "Non conforming namespaces. update() namespaces keys don't satisfy requiredNamespaces",
      );
    });
  });

  describe("extend", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.extend()).rejects.toThrowError(
        "Missing or invalid. extend() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.extend({ topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.extend({ topic: "" })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.extend({ topic: undefined })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.extend({ topic: "none" })).rejects.toThrowError(
        "No matching key. session topic doesn't exist: none",
      );
    });
  });

  describe("request", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.request()).rejects.toThrowError(
        "Missing or invalid. request() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.request({ ...TEST_REQUEST_PARAMS, topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.request({ ...TEST_REQUEST_PARAMS, topic: "" })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic: undefined }),
      ).rejects.toThrowError("Missing or invalid. session topic should be a string: undefined");
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.request({ ...TEST_REQUEST_PARAMS, topic: "none" })).rejects.toThrowError(
        "No matching key. session topic doesn't exist: none",
      );
    });

    it("throws when invalid chainId is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: 123 }),
      ).rejects.toThrowError("Missing or invalid. request() chainId: 123");
    });

    it("throws when empty chainId is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: "" }),
      ).rejects.toThrowError("Missing or invalid. request() chainId: ");
    });

    it("throws when chain id is not in session namespace", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, chainId: "eip000:0" }),
      ).rejects.toThrowError("Missing or invalid. request() chainId: eip000:0");
    });

    it("throws when invalid request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: 123 }),
      ).rejects.toThrowError("Missing or invalid. request() 123");
    });

    it("throws when empty request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: {} }),
      ).rejects.toThrowError("Missing or invalid. request() {}");
    });

    it("throws when no request is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: undefined }),
      ).rejects.toThrowError("Missing or invalid. request() undefined");
    });

    it("throws when invalid request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: 123 } }),
      ).rejects.toThrowError(`Missing or invalid. request() {"method":123}`);
    });

    it("throws when empty request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: "" } }),
      ).rejects.toThrowError(`Missing or invalid. request() {"method":""}`);
    });

    it("throws when no request method is provided", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: undefined } }),
      ).rejects.toThrowError("Missing or invalid. request() {}");
    });

    it("throws when request doesn't exist for given chainId", async () => {
      await expect(
        client.request({ ...TEST_REQUEST_PARAMS, topic, request: { method: "unknown" } }),
      ).rejects.toThrowError("Missing or invalid. request() method: unknown");
    });
  });

  describe("respond", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.respond()).rejects.toThrowError(
        "Missing or invalid. respond() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.respond({ ...TEST_REQUEST_PARAMS, topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.respond({ ...TEST_RESPOND_PARAMS, topic: "" })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(
        client.respond({ ...TEST_RESPOND_PARAMS, topic: undefined }),
      ).rejects.toThrowError("Missing or invalid. session topic should be a string: undefined");
    });

    it("throws when no response or error is passed", async () => {
      await expect(
        client.respond({ ...TEST_RESPOND_PARAMS, topic, response: undefined, error: undefined }),
      ).rejects.toThrowError("Missing or invalid. respond() response: undefined");
    });

    it("throws when no id is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, id: undefined },
        }),
      ).rejects.toThrowError(
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
      ).rejects.toThrowError(
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
      ).rejects.toThrowError(`Missing or invalid. respond() response: {"id":1,"result":{}}`);
    });

    it("throws when invalid jsonrpc is passed", async () => {
      await expect(
        client.respond({
          ...TEST_RESPOND_PARAMS,
          topic,
          response: { ...TEST_RESPOND_PARAMS.response, jsonrpc: 123 },
        }),
      ).rejects.toThrowError(
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
      ).rejects.toThrowError(
        `Missing or invalid. respond() response: {"id":1,"jsonrpc":"","result":{}}`,
      );
    });
  });

  describe("ping", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.ping()).rejects.toThrowError(
        "Missing or invalid. ping() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.ping({ topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.ping({ topic: "" })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.ping({ topic: undefined })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.ping({ topic: "none" })).rejects.toThrowError(
        "No matching key. session or pairing topic doesn't exist: none",
      );
    });
  });

  describe("emit", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   await testConnectMethod(clients);
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.emit()).rejects.toThrowError(
        "Missing or invalid. emit() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: "" })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: undefined })).rejects.toThrowError(
        "Missing or invalid. session topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic: "none" })).rejects.toThrowError(
        "No matching key. session topic doesn't exist: none",
      );
    });

    it("throws when invalid chainId is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic, chainId: 123 })).rejects.toThrowError(
        "Missing or invalid. emit() chainId: 123",
      );
    });

    it("throws when empty chainId is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic, chainId: "" })).rejects.toThrowError(
        "Missing or invalid. emit() chainId: ",
      );
    });

    it("throws when invalid event is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic, event: 123 })).rejects.toThrowError(
        "Missing or invalid. emit() event: 123",
      );
    });

    it("throws when empty event is provided", async () => {
      await expect(client.emit({ ...TEST_EMIT_PARAMS, topic, event: {} })).rejects.toThrowError(
        "Missing or invalid. emit() event: {}",
      );
    });

    it("throws when no event is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: undefined }),
      ).rejects.toThrowError("Missing or invalid. emit() event: undefined");
    });

    it("throws when invalid event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: 123 } }),
      ).rejects.toThrowError(`Missing or invalid. emit() event: {"name":123}`);
    });

    it("throws when empty event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: "" } }),
      ).rejects.toThrowError(`Missing or invalid. emit() event: {"name":""}`);
    });

    it("throws when no event name is provided", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: undefined } }),
      ).rejects.toThrowError(`Missing or invalid. emit() event: {}`);
    });

    it("throws when event doesn't exist for given chainId", async () => {
      await expect(
        client.emit({ ...TEST_EMIT_PARAMS, topic, event: { name: "unknown" } }),
      ).rejects.toThrowError(`Missing or invalid. emit() event: {"name":"unknown"}`);
    });
  });

  describe("disconnect", () => {
    // let clients: Clients;
    // beforeAll(async () => {
    //   clients = await initTwoClients();
    //   client = clients.A;
    //   pairingTopic = client.pairing.keys[0];
    //   proposalId = client.proposal.keys[0];
    //   topic = client.session.keys[0];
    // });

    // afterAll(async () => {
    //   await deleteClients(clients);
    // });

    it("throws when no params are passed", async () => {
      await expect(client.disconnect()).rejects.toThrowError(
        "Missing or invalid. disconnect() params: undefined",
      );
    });

    it("throws when invalid topic is provided", async () => {
      await expect(client.disconnect({ topic: 123 })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: 123",
      );
    });

    it("throws when empty topic is provided", async () => {
      await expect(client.disconnect({ topic: "" })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: ",
      );
    });

    it("throws when no topic is provided", async () => {
      await expect(client.disconnect({ topic: undefined })).rejects.toThrowError(
        "Missing or invalid. session or pairing topic should be a string: undefined",
      );
    });

    it("throws when non existant topic is provided", async () => {
      await expect(client.disconnect({ topic: "none" })).rejects.toThrowError(
        "No matching key. session or pairing topic doesn't exist: none",
      );
    });
  });
});
