import { RELAYER_EVENTS } from "@walletconnect/core";
import { formatJsonRpcError, JsonRpcError } from "@walletconnect/jsonrpc-utils";
import { RelayerTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it, vi } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  throttle,
  TEST_REQUEST_PARAMS,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE,
  TEST_AVALANCHE_CHAIN,
  TEST_REQUIRED_NAMESPACES_V2,
  TEST_NAMESPACES_V2,
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
      const { pairingA, sessionA } = await testConnectMethod(clients);
      expect(pairingA).to.be.exist;
      expect(sessionA).to.be.exist;
      expect(pairingA.topic).to.eq(sessionA.pairingTopic);
      const sessionB = clients.B.session.get(sessionA.topic);
      expect(sessionB).to.be.exist;
      expect(sessionB.pairingTopic).to.eq(sessionA.pairingTopic);
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
    it("should receive session acknowledge", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic, acknowledged },
      } = await testConnectMethod(clients);
      await throttle(5_000);
      const session = clients.B.session.get(topic);
      expect(session.acknowledged).to.be.true;
      expect(acknowledged).to.be.true;
      await deleteClients(clients);
    });
    it("should cleanup duplicate pairings", async () => {
      const clients = await initTwoClients();
      const { pairingA, sessionA } = await testConnectMethod(clients);
      expect(pairingA).to.be.exist;
      expect(sessionA).to.be.exist;
      expect(pairingA.topic).to.eq(sessionA.pairingTopic);
      const sessionB = clients.B.session.get(sessionA.topic);
      expect(sessionB).to.be.exist;
      expect(sessionB.pairingTopic).to.eq(sessionA.pairingTopic);
      await clients.A.disconnect({
        topic: sessionA.topic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
      expect(clients.A.pairing.getAll().length).to.eq(1);
      const { pairingA: pairingAfter, sessionA: sessionAfter } = await testConnectMethod(clients);
      await throttle(1_000);
      expect(pairingA.topic).to.not.eq(pairingAfter.topic);
      expect(sessionA.topic).to.not.eq(sessionAfter.topic);
      expect(sessionA.pairingTopic).to.not.eq(sessionAfter.pairingTopic);
      expect(sessionAfter.pairingTopic).to.eq(pairingAfter.topic);
      expect(clients.A.pairing.getAll().length).to.eq(1);
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
  describe("namespaces", () => {
    it("should pair with empty namespaces", async () => {
      const clients = await initTwoClients();
      const requiredNamespaces = {};
      const { sessionA } = await testConnectMethod(clients, {
        requiredNamespaces,
        namespaces: TEST_NAMESPACES,
      });
      expect(requiredNamespaces).toMatchObject({});
      // requiredNamespaces are built internally from the namespaces during approve()
      expect(sessionA.requiredNamespaces).toMatchObject(TEST_REQUIRED_NAMESPACES);
      expect(sessionA.requiredNamespaces).toMatchObject(
        clients.B.session.get(sessionA.topic).requiredNamespaces,
      );
      await deleteClients(clients);
    });
  });

  describe("session requests", () => {
    it("should set custom request expiry", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);

      const expiry = 10000;

      await Promise.all([
        new Promise<void>((resolve) => {
          clients.A.core.relayer.once(
            RELAYER_EVENTS.publish,
            (payload: RelayerTypes.PublishPayload) => {
              // ttl of the request should match the expiry
              expect(payload?.opts?.ttl).toEqual(expiry);
              resolve();
            },
          );
        }),
        new Promise<void>((resolve) => {
          clients.A.request({ ...TEST_REQUEST_PARAMS, topic, expiry });
          resolve();
        }),
      ]);
      await deleteClients(clients);
    });
    it("should send request on optional namespace", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_request", (payload) => {
            const { params } = payload;
            expect(params).toMatchObject(TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE);
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          clients.A.request({ ...TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE, topic });
          resolve();
        }),
      ]);
      await deleteClients(clients);
    });
    it("should send request on inline indexed namespace", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients, {
        requiredNamespaces: TEST_REQUIRED_NAMESPACES_V2,
        namespaces: TEST_NAMESPACES_V2,
      });
      const testRequestProps = {
        ...TEST_REQUEST_PARAMS,
        chainId: TEST_AVALANCHE_CHAIN,
      };
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_request", (payload) => {
            const { params } = payload;
            const session = clients.B.session.get(payload.topic);
            expect(params).toMatchObject(testRequestProps);
            expect(
              session.namespaces.eip155.accounts.filter((acc) =>
                acc.includes(TEST_AVALANCHE_CHAIN),
              ),
            ).to.exist;
            expect(session.requiredNamespaces[TEST_AVALANCHE_CHAIN]).to.exist;
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          clients.A.request({ ...testRequestProps, topic });
          resolve();
        }),
      ]);
      await deleteClients(clients);
    });
  });
});
