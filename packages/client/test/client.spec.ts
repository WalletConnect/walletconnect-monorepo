import { delay } from "@walletconnect/time";
import { ERROR } from "@walletconnect/utils";
import "mocha";
import Client from "../src";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_CLIENT_DATABASE,
  TEST_CLIENT_OPTIONS,
} from "./shared";

describe("Client", () => {
  it("init", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("connect", () => {
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
        namespaces: [],
        accounts: [],
      });
    });
  });

  describe("disconnect", () => {
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        const reason = ERROR.USER_DISCONNECTED.format();
        await clients.A.disconnect({ topic, reason });
        await expect(clients.A.pairing.get(topic)).to.eventually.be.rejectedWith(
          `No matching pairing with topic: ${topic}`,
        );
        const promise = clients.A.ping({ topic });
        await expect(promise).to.eventually.be.rejectedWith(
          `No matching pairing or session with topic: ${topic}`,
        );
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        const reason = ERROR.USER_DISCONNECTED.format();
        await clients.A.disconnect({ topic, reason });
        await expect(clients.A.session.get(topic)).to.eventually.be.rejectedWith(
          `No matching session with topic: ${topic}`,
        );
        const promise = clients.A.ping({ topic });
        await expect(promise).to.eventually.be.rejectedWith(
          `No matching pairing or session with topic: ${topic}`,
        );
      });
    });
  });

  describe("ping", () => {
    it("throws if the topic is not a known pairing or session topic", async () => {
      const clients = await initTwoClients();
      const fakeTopic = "nonsense";
      await expect(clients.A.ping({ topic: fakeTopic })).to.eventually.be.rejectedWith(
        `No matching pairing or session with topic: ${fakeTopic}`,
      );
    });
    describe("pairing", () => {
      it("A pings B with existing pairing", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        await clients.A.ping({ topic });
      });
      it("B pings A with existing pairing", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        await clients.B.ping({ topic });
      });
      it("clients can ping each other after restart", async () => {
        const beforeClients = await initTwoClients({
          storageOptions: { database: TEST_CLIENT_DATABASE },
        });
        const {
          pairingA: { topic },
        } = await testConnectMethod(beforeClients);
        // ping
        await beforeClients.A.ping({ topic });
        await beforeClients.B.ping({ topic });
        // delete
        delete beforeClients.A;
        delete beforeClients.B;
        // restart
        const afterClients = await initTwoClients({
          storageOptions: { database: TEST_CLIENT_DATABASE },
        });
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.B.ping({ topic });
      });
    });
    describe("session", () => {
      it("A pings B with existing session", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        await clients.A.ping({ topic });
      });
      it("B pings A with existing session", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        await clients.B.ping({ topic });
      });
      it("clients can ping each other after restart", async () => {
        const beforeClients = await initTwoClients({
          storageOptions: { database: TEST_CLIENT_DATABASE },
        });
        const {
          sessionA: { topic },
        } = await testConnectMethod(beforeClients);
        // ping
        await beforeClients.A.ping({ topic });
        await beforeClients.B.ping({ topic });
        // delete
        delete beforeClients.A;
        delete beforeClients.B;
        // restart
        const afterClients = await initTwoClients({
          storageOptions: { database: TEST_CLIENT_DATABASE },
        });
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.B.ping({ topic });
      });
    });
  });

  describe("updateAccounts", () => {
    it("updates session account state with provided accounts", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const accountsBefore = (await clients.A.session.get(topic)).accounts;
      const accountsAfter = [
        ...accountsBefore,
        "eip155:42:0x3c582121909DE92Dc89A36898633C1aE4790382b",
      ];
      await clients.A.updateAccounts({
        topic,
        accounts: accountsAfter,
      });
      const result = (await clients.A.session.get(topic)).accounts;
      expect(result).to.eql(accountsAfter);
    });
  });

  describe("updateNamespaces", () => {
    it("updates session namespaces state with provided namespaces", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const namespacesBefore = (await clients.A.session.get(topic)).namespaces;
      const namespacesAfter = [
        ...namespacesBefore,
        { chains: ["eip155:12"], methods: ["eth_sendTransaction"], events: ["accountsChanged"] },
      ];
      await clients.A.updateNamespaces({
        topic,
        namespaces: namespacesAfter,
      });
      const result = (await clients.A.session.get(topic)).namespaces;
      expect(result).to.eql(namespacesAfter);
    });
  });

  describe("updateExpiry", () => {
    it("updates session expiry state with provided expiry", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const expiryBefore = (await clients.A.session.get(topic)).expiry;
      const expiryAfter = expiryBefore + 1000;
      await clients.A.updateExpiry({
        topic,
        expiry: expiryAfter,
      });
      const result = (await clients.A.session.get(topic)).expiry;
      expect(result).to.eql(expiryAfter);
    });
  });
});
