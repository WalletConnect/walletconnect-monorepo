import {
  formatJsonRpcError,
  formatJsonRpcResult,
  JsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import { calcExpiry, getSdkError, parseUri } from "@walletconnect/utils";
import { expect, describe, it, vi } from "vitest";
import SignClient, {
  ENGINE_QUEUE_STATES,
  ENGINE_RPC_OPTS,
  WALLETCONNECT_DEEPLINK_CHOICE,
} from "../../src";

import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  throttle,
  TEST_REQUEST_PARAMS,
  TEST_NAMESPACES,
  TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE,
  TEST_AVALANCHE_CHAIN,
  TEST_REQUIRED_NAMESPACES_V2,
  TEST_NAMESPACES_V2,
  initTwoPairedClients,
  TEST_CONNECT_PARAMS,
} from "../shared";
import { RELAYER_EVENTS } from "@walletconnect/core";

describe("Sign Client Integration", () => {
  it("init", async () => {
    const client = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "init",
      signConfig: { disableRequestQueue: true },
    });
    expect(client).to.be.exist;
    expect(client.metadata.redirect).to.exist;
    expect(client.metadata.redirect?.universal).to.exist;
    expect(client.metadata.redirect?.native).to.not.exist;
    expect(client.signConfig).to.exist;
    expect(client.signConfig?.disableRequestQueue).to.be.true;
    await deleteClients({ A: client, B: undefined });
  });

  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const { clients, sessionA, pairingA } = await initTwoPairedClients(
        {},
        {},
        { logger: "error" },
      );
      expect(pairingA).to.be.exist;
      expect(sessionA).to.be.exist;
      expect(pairingA.topic).to.eq(sessionA.pairingTopic);
      const sessionB = clients.B.session.get(sessionA.topic);
      expect(sessionB).to.be.exist;
      expect(sessionB.pairingTopic).to.eq(sessionA.pairingTopic);
      expect(clients.A.metadata.redirect).to.exist;
      expect(clients.A.metadata.redirect?.native).to.exist;
      expect(clients.A.metadata.redirect?.universal).to.exist;
      expect(clients.B.metadata.redirect).to.exist;
      expect(clients.B.metadata.redirect?.native).to.exist;
      expect(clients.B.metadata.redirect?.universal).to.exist;
      await deleteClients(clients);
    });
    it("connect (with old pairing)", async () => {
      const {
        clients,
        pairingA: { topic: pairingTopic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      await throttle(200);
      await testConnectMethod(clients, {
        pairingTopic,
      });
      await deleteClients(clients);
    });
    it("should remove duplicate pairing", async () => {
      const { clients } = await initTwoPairedClients({}, {}, { logger: "error" });
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      expect(A.pairing.keys.length).to.eql(1);
      await throttle(1000);
      await testConnectMethod(clients);
      await throttle(1000);
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      expect(A.pairing.keys.length).to.eql(1);
      await deleteClients(clients);
    });
    it("should receive session acknowledge", async () => {
      const {
        clients,
        sessionA: { topic, acknowledged },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      await throttle(5_000);
      const session = clients.B.session.get(topic);
      expect(session.acknowledged).to.be.true;
      expect(acknowledged).to.be.true;
      await deleteClients(clients);
    });
    it("should cleanup duplicate pairings", async () => {
      const { clients, sessionA, pairingA } = await initTwoPairedClients(
        {},
        {},
        { logger: "error" },
      );
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
    it("should emit session_proposal on every pair attempt with same URI as long as the proposal has not yet been approved or rejected", async () => {
      const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
      const wallet = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "wallet" });
      const { uri, approval } = await dapp.connect(TEST_CONNECT_PARAMS);
      if (!uri) throw new Error("URI is undefined");
      expect(uri).to.exist;
      const parsedUri = parseUri(uri);
      // 1. attempt to pair
      // 2. receive the session_proposal event
      // 3. avoid approving or rejecting the proposal - simulates accidental closing of the app/modal etc
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.once("session_proposal", (params) => {
            expect(params).to.exist;
            expect(params.params.pairingTopic).to.eq(parsedUri.topic);
            resolve();
          });
        }),
        wallet.pair({ uri }),
      ]);
      // 4. attempt to pair again with the same URI
      // 5. receive the session_proposal event again
      // 6. approve the proposal
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.once("session_proposal", async (params) => {
            expect(params).to.exist;
            expect(params.params.pairingTopic).to.eq(parsedUri.topic);
            await wallet.approve({ id: params.id, namespaces: TEST_NAMESPACES });
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          const session = await approval();
          expect(session).to.exist;
          expect(session.topic).to.exist;
          expect(session.pairingTopic).to.eq(parsedUri.topic);
          resolve();
        }),
        wallet.pair({ uri }),
      ]);

      // 7. attempt to pair again with the same URI
      // 8. should receive an error the pairing already exists
      await expect(wallet.pair({ uri })).rejects.toThrowError();
      await deleteClients({ A: dapp, B: wallet });
    });
    it("should set `sessionConfig`", async () => {
      const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
      const wallet = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "wallet" });
      const { uri, approval } = await dapp.connect(TEST_CONNECT_PARAMS);
      if (!uri) throw new Error("URI is undefined");
      expect(uri).to.exist;
      const parsedUri = parseUri(uri);
      const sessionConfig = {
        disableDeepLink: true,
      };
      let sessionTopic = "";
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.once("session_proposal", async (params) => {
            expect(params).to.exist;
            expect(params.params.pairingTopic).to.eq(parsedUri.topic);
            const { acknowledged } = await wallet.approve({
              id: params.id,
              namespaces: TEST_NAMESPACES,
              sessionConfig,
            });
            sessionTopic = (await acknowledged()).topic;
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          const session = await approval();
          expect(session).to.exist;
          expect(session.topic).to.exist;
          expect(session.pairingTopic).to.eq(parsedUri.topic);
          resolve();
        }),
        wallet.pair({ uri }),
      ]);
      const sessionDapp = dapp.session.get(sessionTopic);
      const sessionWallet = wallet.session.get(sessionTopic);
      expect(sessionDapp).to.exist;
      expect(sessionWallet).to.exist;
      expect(sessionDapp.sessionConfig).to.eql(sessionConfig);
      expect(sessionWallet.sessionConfig).to.eql(sessionConfig);
      expect(sessionWallet.sessionConfig).to.eql(sessionDapp.sessionConfig);
      await deleteClients({ A: dapp, B: wallet });
    });
    it("should use rejected tag for session_propose", async () => {
      const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
      const wallet = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "wallet" });
      const { uri } = await dapp.connect(TEST_CONNECT_PARAMS);
      if (!uri) throw new Error("URI is undefined");
      expect(uri).to.exist;
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.core.relayer.once(RELAYER_EVENTS.publish, (payload) => {
            const { opts } = payload;
            const expectedOpts = ENGINE_RPC_OPTS.wc_sessionPropose.reject;
            expect(opts).to.exist;
            expect(opts.tag).to.eq(expectedOpts?.tag);
            expect(opts.ttl).to.eq(expectedOpts?.ttl);
            expect(opts.prompt).to.eq(expectedOpts?.prompt);
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          wallet.once("session_proposal", async (params) => {
            await wallet.reject({ id: params.id, reason: getSdkError("USER_REJECTED") });
            resolve();
          });
        }),
        wallet.pair({ uri }),
      ]);
      await deleteClients({ A: dapp, B: wallet });
    });
  });

  describe("disconnect", () => {
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const {
          clients,
          pairingA: { topic },
        } = await initTwoPairedClients({}, {}, { logger: "error" });
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.pairing.get(topic)).to.throw(
          `Missing or invalid. Record was recently deleted - pairing: ${topic}`,
        );
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        await deleteClients(clients);
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const {
          clients,
          sessionA: { topic, self },
        } = await initTwoPairedClients({}, {}, { logger: "error" });
        const { self: selfB } = clients.B.session.get(topic);
        expect(clients.A.core.crypto.keychain.has(topic)).to.be.true;
        expect(clients.A.core.crypto.keychain.has(self.publicKey)).to.be.true;
        expect(clients.B.core.crypto.keychain.has(topic)).to.be.true;
        expect(clients.B.core.crypto.keychain.has(selfB.publicKey)).to.be.true;
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        const promise = clients.A.ping({ topic });
        expect(() => clients.A.session.get(topic)).to.throw(
          `Missing or invalid. Record was recently deleted - session: ${topic}`,
        );
        await expect(promise).rejects.toThrowError(
          `Missing or invalid. Record was recently deleted - session: ${topic}`,
        );
        await throttle(2_000);
        expect(clients.A.core.crypto.keychain.has(topic)).to.be.false;
        expect(clients.A.core.crypto.keychain.has(self.publicKey)).to.be.false;
        expect(clients.B.core.crypto.keychain.has(topic)).to.be.false;
        expect(clients.B.core.crypto.keychain.has(selfB.publicKey)).to.be.false;
        await deleteClients(clients);
      });
    });
    describe("deeplinks", () => {
      it("should clear `WALLETCONNECT_DEEPLINK_CHOICE` from storage on disconnect", async () => {
        const {
          clients,
          sessionA: { topic },
        } = await initTwoPairedClients({}, {}, { logger: "error" });
        const deepLink = "dummy deep link";
        await clients.A.core.storage.setItem(WALLETCONNECT_DEEPLINK_CHOICE, deepLink);
        expect(await clients.A.core.storage.getItem(WALLETCONNECT_DEEPLINK_CHOICE)).to.eq(deepLink);
        await clients.A.disconnect({ topic, reason: getSdkError("USER_DISCONNECTED") });
        // small delay to finish disconnect
        await throttle(500);
        expect(await clients.A.core.storage.getItem(WALLETCONNECT_DEEPLINK_CHOICE)).to.be.undefined;
        await deleteClients(clients);
      });
    });
    describe("request queue", () => {
      it("should reset request queue state on disconnect", async () => {
        const {
          clients,
          sessionA: { topic },
        } = await initTwoPairedClients({}, {}, { logger: "error" });
        await new Promise<void>((resolve) => {
          clients.B.once("session_request", () => {
            resolve();
          });
          clients.A.request({
            topic,
            ...TEST_REQUEST_PARAMS,
          });
        });

        expect(clients.B.pendingRequest.getAll().length).to.eq(1);
        // @ts-expect-error - sessionRequestQueue is private property
        expect(clients.B.engine.sessionRequestQueue.state).to.eq(ENGINE_QUEUE_STATES.active);

        await Promise.all([
          new Promise<void>((resolve) => {
            clients.B.once("session_delete", () => {
              resolve();
            });
          }),
          clients.A.disconnect({ topic, reason: getSdkError("USER_DISCONNECTED") }),
        ]);
        // small delay as deleting pending requests is async
        await throttle(5_00);
        expect(clients.B.pendingRequest.getAll().length).to.eq(0);
        // @ts-expect-error - sessionRequestQueue is private property
        expect(clients.B.engine.sessionRequestQueue.state).to.eq(ENGINE_QUEUE_STATES.idle);
        // @ts-expect-error - force close the transport due to pending session request
        clients.A.core.relayer.hasExperiencedNetworkDisruption = true;
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
          const {
            clients,
            pairingA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const {
            clients,
            pairingA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
      });
    });
    describe("session", () => {
      describe("with existing session", () => {
        it("A pings B", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
        it("can get pending session request", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });

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
          await throttle(1_000);
          await deleteClients(clients);
        });
        it("should process requests queue", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          const expectedRequests = 5;
          let receivedRequests = 0;
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.on("session_request", async (args) => {
                receivedRequests++;
                const { id, topic } = args;
                await clients.B.respond({
                  topic,
                  response: formatJsonRpcResult(id, "ok"),
                });
                if (receivedRequests >= expectedRequests) resolve();
              });
            }),
            Array.from(Array(expectedRequests).keys()).map(
              async () =>
                await clients.A.request({
                  topic,
                  ...TEST_REQUEST_PARAMS,
                }),
            ),
          ]);
          await throttle(1000);
          await deleteClients(clients);
        });
        it("should disable requests queue via `signConfig`", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            { signConfig: { disableRequestQueue: true } },
            { logger: "error" },
          );
          let firstRequestId;
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", (args) => {
                const { id, topic } = args;
                firstRequestId = id;
                // validate that theres only one request pending (the one we just received)
                const pendingRequests = clients.B.pendingRequest.getAll();
                expect(pendingRequests.length).to.eq(1);
                resolve();
              });
            }),
            new Promise<void>((resolve) => {
              clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
              });
              resolve();
            }),
          ]);
          await throttle(1000);
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const { id, topic } = args;
                const pendingRequests = clients.B.pendingRequest.getAll();
                // validate that there are two requests pending
                expect(pendingRequests.length).to.eq(2);
                // validate the IDs are different even though we didn't respond to the first request
                // if the queue was active, we would've received the first request again
                expect(id).to.not.eq(firstRequestId);
                // validate we can respond to the second request successfully
                await clients.B.respond({
                  topic,
                  response: formatJsonRpcResult(id, "ok"),
                });
                resolve();
              });
            }),
            clients.A.request({
              topic,
              ...TEST_REQUEST_PARAMS,
            }),
          ]);
          // validate the first request is still pending
          expect(clients.B.pendingRequest.getAll().length).to.eq(1);
          expect(clients.B.pendingRequest.getAll()[0].id).to.eq(firstRequestId);

          await clients.B.respond({
            topic,
            response: formatJsonRpcResult(firstRequestId, "ok"),
          });

          await deleteClients(clients);
        });
        /**
         * this test simulates the case where a session is disconnected
         * while session request is being approved
         * the queue should continue operating normally after the `respond` rejection
         */
        it("continue processing requests queue after respond rejection due to disconnected session", async () => {
          // create the clients and pair them
          const {
            clients,
            sessionA: { topic: topicA },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          const dapp = clients.A as SignClient;
          const wallet = clients.B as SignClient;
          const { uri, approval } = await dapp.connect({
            requiredNamespaces: {},
          });

          let topicB = "";
          await Promise.all([
            new Promise<void>((resolve) => {
              wallet.once("session_proposal", async (args) => {
                const { id } = args.params;
                await wallet.approve({
                  id,
                  namespaces: TEST_NAMESPACES,
                });
                resolve();
              });
            }),
            wallet.pair({ uri: uri! }),
            new Promise<void>(async (resolve) => {
              const session = await approval();
              topicB = session.topic;
              resolve();
            }),
          ]);

          const expectedRequests = 5;
          let receivedRequests = 0;
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.on("session_request", async (args) => {
                receivedRequests++;
                const { id, topic } = args;

                // capture the request on topicB, disconnect and try to approve the request
                if (topic === topicB) {
                  await new Promise<void>(async (_resolve) => {
                    await wallet.disconnect({
                      topic,
                      reason: getSdkError("USER_DISCONNECTED"),
                    });
                    _resolve();
                  });
                }
                await clients.B.respond({
                  topic,
                  response: formatJsonRpcResult(id, "ok"),
                }).catch((err) => {
                  // eslint-disable-next-line no-console
                  console.log("respond error", err);
                });
                if (receivedRequests > expectedRequests) resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              await Promise.all([
                ...Array.from(Array(expectedRequests).keys()).map(
                  async () =>
                    await clients.A.request({
                      topic: topicA,
                      ...TEST_REQUEST_PARAMS,
                    }),
                ),
                clients.A.request({
                  topic: topicB,
                  ...TEST_REQUEST_PARAMS,
                  // eslint-disable-next-line no-console
                }).catch((e) => console.error(e)), // capture the error from the session disconnect
              ]);
              resolve();
            }),
          ]);
          await throttle(1000);
          await deleteClients(clients);
        });
        it("should handle invalid session state with missing keychain", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients({}, {}, { logger: "error" });
          const dapp = clients.A as SignClient;
          const sessions = dapp.session.getAll();
          expect(sessions.length).to.eq(1);
          await dapp.core.crypto.keychain.del(topic);
          await Promise.all([
            new Promise<void>((resolve) => {
              dapp.on("session_delete", async (args) => {
                const { topic: sessionTopic } = args;
                expect(sessionTopic).to.eq(topic);
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              try {
                await dapp.ping({ topic });
              } catch (err) {
                expect(err.message).to.eq(
                  `Missing or invalid. session topic does not exist in keychain: ${topic}`,
                );
              }
              resolve();
            }),
          ]);

          const sessionsAfter = dapp.session.getAll();
          expect(sessionsAfter.length).to.eq(0);

          await deleteClients(clients);
        });
      });
    });
  });
  describe("update", () => {
    it("updates session namespaces state with provided namespaces", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
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
    it("updates session expiry state initiated by client A", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      const prevExpiry = clients.A.session.get(topic).expiry;
      vi.useFakeTimers({ shouldAdvanceTime: true });
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
    it("updates session expiry state initiated by client B", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      const prevExpiry = clients.A.session.get(topic).expiry;
      vi.useFakeTimers({ shouldAdvanceTime: true });
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
      expect(sessionA.requiredNamespaces).toMatchObject(
        clients.B.session.get(sessionA.topic).requiredNamespaces,
      );
      await deleteClients(clients);
    });
  });

  describe("session requests", () => {
    it("should set custom request expiry", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      const expiry = 600; // 10 minutes in seconds

      await Promise.all([
        new Promise<void>((resolve) => {
          (clients.B as SignClient).once("session_request", async (payload) => {
            expect(payload.params.request.expiryTimestamp).to.be.approximately(
              calcExpiry(expiry),
              1000,
            );
            await clients.B.respond({
              topic,
              response: formatJsonRpcResult(payload.id, "test response"),
            });
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          await clients.A.request({ ...TEST_REQUEST_PARAMS, topic, expiry });
          resolve();
        }),
      ]);
      await deleteClients(clients);
    });
    it("should send request on optional namespace", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_request", async (payload) => {
            const { params } = payload;
            expect(params).toMatchObject(TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE);
            await clients.B.respond({
              topic,
              response: formatJsonRpcResult(payload.id, "test response"),
            });
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          await clients.A.request({ ...TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE, topic });
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
          clients.B.once("session_request", async (payload) => {
            const { params } = payload;
            const session = clients.B.session.get(payload.topic);
            expect(params).toMatchObject(testRequestProps);
            expect(
              session.namespaces.eip155.accounts.filter((acc) =>
                acc.includes(TEST_AVALANCHE_CHAIN),
              ),
            ).to.exist;
            expect(session.requiredNamespaces[TEST_AVALANCHE_CHAIN]).to.exist;
            await clients.B.respond({
              topic,
              response: formatJsonRpcResult(payload.id, "test response"),
            });
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          await clients.A.request({ ...testRequestProps, topic });
          resolve();
        }),
      ]);
      await deleteClients(clients);
    });
  });
});
