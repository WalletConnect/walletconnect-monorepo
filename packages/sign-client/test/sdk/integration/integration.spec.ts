import { PairingTypes, SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it, afterAll, beforeAll } from "vitest";
import { createExpiringPromise } from "../../../../utils/src";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  Clients,
  TESTS_CONNECT_TIMEOUT,
  TESTS_CONNECT_RETRIES,
  initTwoPairedClients,
} from "../../shared";

describe("Sign Client Integration", () => {
  let clients: Clients;
  let pairingA: PairingTypes.Struct;
  let sessionA: SessionTypes.Struct;

  beforeAll(async () => {
    ({ clients, pairingA, sessionA } = await initTwoPairedClients());
  });

  afterAll(async () => {
    await deleteClients(clients);
  });

  it("init", () => {
    expect(clients.A).to.be.exist;
    expect(clients.B).to.be.exist;
  });
  describe("connect", () => {
    it("connect (with old pairing)", async () => {
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      await testConnectMethod(clients, {
        pairingTopic: pairingA.topic,
      });
    });
  });
  describe("update", () => {
    it("updates session namespaces state with provided namespaces", async () => {
      const topic = sessionA.topic;
      const namespacesBefore = clients.A.session.get(topic).namespaces;
      const namespacesAfter = {
        ...namespacesBefore,
        eip9001: {
          accounts: ["eip9001:1:0x000000000000000000000000000000000000dead"],
          methods: ["eth_sendTransaction"],
          events: ["accountsChanged"],
        },
      };
      const { acknowledged } = await clients.A.update({
        topic,
        namespaces: namespacesAfter,
      });
      await acknowledged();
      const result = clients.A.session.get(topic).namespaces;
      expect(result).to.eql(namespacesAfter);
    });
  });
  describe("disconnect", () => {
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const topic = pairingA.topic;
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.pairing.get(topic)).to.throw(`No matching key. pairing: ${topic}`);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const topic = sessionA.topic;
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        const promise = clients.A.ping({ topic });
        expect(() => clients.A.session.get(topic)).to.throw(`No matching key. session: ${topic}`);
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
      });
    });
  });
});
