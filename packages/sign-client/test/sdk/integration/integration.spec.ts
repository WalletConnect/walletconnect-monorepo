import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it, vi, afterAll } from "vitest";
import { initTwoClients, testConnectMethod, deleteClients, Clients } from "../../shared";

describe("Sign Client Integration", () => {
  let clients: Clients;
  let pairingA: any;
  let sessionA: any;

  afterAll(async () => {
    await deleteClients(clients);
  });

  it("init", async () => {
    clients = await initTwoClients();
    expect(clients.A).to.be.exist;
    expect(clients.B).to.be.exist;
  });
  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const settled = await testConnectMethod(clients);
      pairingA = settled.pairingA;
      sessionA = settled.sessionA;
    });
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

  describe("extend", () => {
    it.skip("updates session expiry state", async () => {
      const clients = await initTwoClients(
        { name: "session extend A" },
        { name: "session extend B" },
      );
      vi.useFakeTimers();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const prevExpiry = clients.A.session.get(topic).expiry;
      vi.useFakeTimers();
      // Fast-forward system time by 60 seconds after expiry was first set.
      vi.setSystemTime(Date.now() + 60_000);
      const { acknowledged } = await clients.A.extend({
        topic,
      });
      await acknowledged();
      const updatedExpiry = clients.A.session.get(topic).expiry;
      expect(updatedExpiry).to.be.greaterThan(prevExpiry);
      vi.useRealTimers();
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
