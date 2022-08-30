import { getSdkError, calcExpiry } from "@walletconnect/utils";
import { expect, describe, it } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
} from "../shared";
import { SEVEN_DAYS } from "@walletconnect/time";

const TEST_SIGN_CLIENT_A_DATABASE = "./test/client_a.db";
const TEST_SIGN_CLIENT_B_DATABASE = "./test/client_b.db";

describe("Sign Client Integration", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      deleteClients(clients);
    });
    it("connect (with old pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      const { topic: pairingTopic } = A.pairing.get(A.pairing.keys[0]);
      await testConnectMethod(clients, {
        pairingTopic,
      });
      deleteClients(clients);
    }, 120_000);
  });

  describe("disconnect", () => {
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.pairing.get(topic)).to.throw(`No matching key. pairing: ${topic}`);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        deleteClients(clients);
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.session.get(topic)).to.throw(`No matching key. session: ${topic}`);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        deleteClients(clients);
      });
    });
  });

  describe("ping", () => {
    it("throws if the topic is not a known pairing or session topic", async () => {
      const clients = await initTwoClients();
      const fakeTopic = "nonsense";
      await expect(clients.A.ping({ topic: fakeTopic })).rejects.toThrowError(
        `No matching key. session or pairing topic doesn't exist: ${fakeTopic}`,
      );
      deleteClients(clients);
    });
    describe("pairing", () => {
      it("A pings B with existing pairing", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        await clients.A.ping({ topic });
        deleteClients(clients);
      });
      it("B pings A with existing pairing", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        await clients.B.ping({ topic });
        deleteClients(clients);
      });
      it("clients can ping each other after restart", async () => {
        const beforeClients = await initTwoClients(
          {},
          {
            storageOptions: { database: TEST_SIGN_CLIENT_A_DATABASE },
          },
          {
            storageOptions: { database: TEST_SIGN_CLIENT_B_DATABASE },
          },
        );
        const {
          pairingA: { topic },
        } = await testConnectMethod(beforeClients);
        // ping
        await beforeClients.A.ping({ topic });
        await beforeClients.B.ping({ topic });
        // delete
        deleteClients(beforeClients);
        // restart
        const afterClients = await initTwoClients(
          {},
          {
            storageOptions: { database: TEST_SIGN_CLIENT_A_DATABASE },
          },
          {
            storageOptions: { database: TEST_SIGN_CLIENT_B_DATABASE },
          },
        );
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.B.ping({ topic });
        deleteClients(afterClients);
      });
    });
    describe("session", () => {
      it("A pings B with existing session", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        await clients.A.ping({ topic });
        deleteClients(clients);
      });
      it("B pings A with existing session", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        await clients.B.ping({ topic });
        deleteClients(clients);
      });
      it("clients can ping each other after restart", async () => {
        const beforeClients = await initTwoClients(
          {},
          {
            storageOptions: { database: TEST_SIGN_CLIENT_A_DATABASE },
          },
          {
            storageOptions: { database: TEST_SIGN_CLIENT_B_DATABASE },
          },
        );
        const {
          sessionA: { topic },
        } = await testConnectMethod(beforeClients);
        // ping
        await beforeClients.A.ping({ topic });
        await beforeClients.B.ping({ topic });
        // delete
        deleteClients(beforeClients);
        // restart
        const afterClients = await initTwoClients(
          {},
          {
            storageOptions: { database: TEST_SIGN_CLIENT_A_DATABASE },
          },
          {
            storageOptions: { database: TEST_SIGN_CLIENT_B_DATABASE },
          },
        );
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.B.ping({ topic });
        deleteClients(afterClients);
      });
    });
  });

  describe("update", () => {
    it("updates session namespaces state with provided namespaces", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
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
      deleteClients(clients);
    });
  });

  describe("extend", () => {
    it("updates session expiry state", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      // Adjusted due to tests sometimes being ahead by 1s
      const newExpiry = calcExpiry(SEVEN_DAYS) - 60;
      const { acknowledged } = await clients.A.extend({
        topic,
      });
      await acknowledged();
      const expiry = clients.A.session.get(topic).expiry;
      expect(expiry).to.be.greaterThanOrEqual(newExpiry);
      deleteClients(clients);
    });
  });
});
