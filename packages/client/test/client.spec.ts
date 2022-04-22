import { ERROR } from "@walletconnect/utils";
import "mocha";

import Client from "../src";

import { expect, initTwoClients, testConnectMethod, TEST_CLIENT_OPTIONS } from "./shared";

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
        chains: [],
        events: [],
        methods: [],
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
        // FIXME: engine.ping is not handling this base case currently, this doesn't throw/reject.
        // const promise = clients.A.ping({ topic });
        // await expect(promise).to.eventually.be.rejectedWith(
        //   `No matching pairing with topic: ${topic}`,
        // );
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
        // FIXME: engine.ping is not handling this base case currently, this doesn't throw/reject.
        // const promise = clients.A.ping({ topic });
        // await expect(promise).to.eventually.be.rejectedWith(
        //   `No matching session settled with topic: ${topic}`,
        // );
      });
    });
  });

  describe("ping", () => {
    // FIXME: engine.ping is not handling this base case currently, this doesn't throw/reject.
    it.skip("throws if the topic is not a known pairing or session topic", async () => {
      const clients = await initTwoClients();
      const fakeTopic = "nonsense";
      await expect(clients.A.ping({ topic: fakeTopic })).to.eventually.be.rejectedWith(
        `No matching session with topic: ${fakeTopic}`,
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
      // TODO: this test requires `engine.ping` to handle unknown topics to avoid false positives.
      it.skip("clients ping each other after restart", async () => {
        const beforeClients = await initTwoClients();
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
        const afterClients = await initTwoClients();
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.A.ping({ topic });
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
      // TODO: this test requires `engine.ping` to handle unknown topics to avoid false positives.
      it.skip("clients ping each other after restart", async () => {
        const beforeClients = await initTwoClients();
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
        const afterClients = await initTwoClients();
        // ping
        await afterClients.A.ping({ topic });
        await afterClients.A.ping({ topic });
      });
    });
  });
});
