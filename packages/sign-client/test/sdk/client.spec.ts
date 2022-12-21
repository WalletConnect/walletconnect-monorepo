import { formatJsonRpcError, JsonRpcError } from "@walletconnect/jsonrpc-utils";
import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it, vi } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  throttle,
  TEST_ETHEREUM_ACCOUNT,
  TEST_ETHEREUM_CHAIN,
  TEST_REQUEST_PARAMS,
} from "../shared";

describe("Sign Client Integration", () => {
  it("init", async () => {
    const client = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "init" });
    expect(client).to.be.exist;
    await deleteClients({ A: client, B: undefined });
  });

  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      await deleteClients(clients);
    });
    it("connect (with old pairing)", async () => {
      const clients = await initTwoClients();
      const {
        pairingA: { topic: pairingTopic },
      } = await testConnectMethod(clients);
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      await throttle(200);
      await testConnectMethod(clients, {
        pairingTopic,
      });
      await deleteClients(clients);
    });
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
        await deleteClients(clients);
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
        const promise = clients.A.ping({ topic });
        expect(() => clients.A.session.get(topic)).to.throw(`No matching key. session: ${topic}`);
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        await deleteClients(clients);
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
      await deleteClients(clients);
    });
    describe("pairing", () => {
      describe("with existing pairing", () => {
        it("A pings B", async () => {
          const clients = await initTwoClients();
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const clients = await initTwoClients();
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
      });
    });
    describe("session", () => {
      describe("with existing session", () => {
        it("A pings B", async () => {
          const clients = await initTwoClients();
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const clients = await initTwoClients();
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
        it("can get pending session request", async () => {
          const clients = await initTwoClients({}, {}, { logger: "error" });
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);

          let rejection: JsonRpcError;

          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.on("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                rejection = formatJsonRpcError(id, getSdkError("USER_REJECTED_METHODS").message);
                await clients.B.respond({
                  topic,
                  response: rejection,
                });
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              try {
                await clients.A.request({
                  topic,
                  ...TEST_REQUEST_PARAMS,
                });
              } catch (err) {
                expect(err.message).toMatch(rejection.error.message);
                resolve();
              }
            }),
          ]);
          await deleteClients(clients);
        });
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
      await deleteClients(clients);
    });
  });

  describe("extend", () => {
    it("updates session expiry state", async () => {
      const clients = await initTwoClients();
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
      await deleteClients(clients);
    });
  });
});
