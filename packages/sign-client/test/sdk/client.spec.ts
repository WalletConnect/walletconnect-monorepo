/* eslint-disable no-console */
import {
  TEST_APP_METADATA_A,
  TEST_EMPTY_METADATA,
  TEST_WALLET_METADATA,
} from "./../shared/values.js";
import {
  formatJsonRpcError,
  formatJsonRpcResult,
  JsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import {
  calcExpiry,
  getNamespacesChains,
  getNamespacesEvents,
  getNamespacesMethods,
  getSdkError,
  parseUri,
} from "@walletconnect/utils";
import { expect, describe, it, vi } from "vitest";
import SignClient, {
  ENGINE_QUEUE_STATES,
  ENGINE_RPC_OPTS,
  WALLETCONNECT_DEEPLINK_CHOICE,
} from "../../src/index.js";

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
} from "../shared/index.js";
import {
  EVENT_CLIENT_PAIRING_ERRORS,
  EVENT_CLIENT_PAIRING_TRACES,
  EVENT_CLIENT_SESSION_ERRORS,
  RELAYER_EVENTS,
} from "@walletconnect/core";
import { EngineTypes, RelayerTypes } from "@walletconnect/types";

describe.concurrent("Sign Client Integration", () => {
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

  it("should initialize without metadata object", async () => {
    const options = TEST_SIGN_CLIENT_OPTIONS;
    delete options.metadata;
    const client = await SignClient.init({
      ...options,
      name: "init",
      signConfig: { disableRequestQueue: true },
    });
    expect(client).to.be.exist;
    await deleteClients({ A: client, B: undefined });
  });

  it("should initialize with empty metadata", async () => {
    const client = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      metadata: TEST_EMPTY_METADATA,
      name: "init",
      signConfig: { disableRequestQueue: true },
    });
    expect(client).to.be.exist;
    await deleteClients({ A: client, B: undefined });
  });

  describe.concurrent("connect", () => {
    it("connect (with new pairing)", async () => {
      const clients = await initTwoClients({}, {}, { logger: "warn" });

      let proposeSessionPayload: { method: string; params: RelayerTypes.ITVF } | undefined;
      let approveSessionPayload: { method: string; params: RelayerTypes.ITVF } | undefined;

      clients.A.core.relayer.once(RELAYER_EVENTS.publish, (payload) => {
        if (payload.method === "wc_proposeSession") {
          proposeSessionPayload = payload;
        }
      });
      clients.B.core.relayer.once(RELAYER_EVENTS.publish, (payload) => {
        if (payload.method === "wc_approveSession") {
          approveSessionPayload = payload;
        }
      });

      const { pairingA, sessionA } = await testConnectMethod(clients);

      expect(proposeSessionPayload).to.exist;
      expect(approveSessionPayload).to.exist;
      expect(proposeSessionPayload?.params.correlationId).to.exist;
      expect(approveSessionPayload?.params.correlationId).to.exist;
      expect(proposeSessionPayload?.params.correlationId).to.be.a("number");
      expect(proposeSessionPayload?.params.correlationId).to.be.greaterThan(0);
      expect(proposeSessionPayload?.params.correlationId).to.eq(
        approveSessionPayload?.params.correlationId,
      );

      const approvedChains = getNamespacesChains(sessionA.namespaces);
      const approvedMethods = getNamespacesMethods(sessionA.namespaces);
      const approvedEvents = getNamespacesEvents(sessionA.namespaces);
      expect(approvedChains).to.exist;
      expect(approvedChains).to.have.length.greaterThan(1);
      expect(approvedMethods).to.exist;
      expect(approvedMethods).to.have.length.greaterThan(1);
      expect(approvedEvents).to.exist;
      expect(approvedEvents).to.have.length.greaterThan(1);
      expect(approvedChains).to.deep.equal(approveSessionPayload?.params.approvedChains);
      expect(approvedMethods).to.deep.equal(approveSessionPayload?.params.approvedMethods);
      expect(approvedEvents).to.deep.equal(approveSessionPayload?.params.approvedEvents);
      expect(sessionA.scopedProperties).to.deep.equal(
        approveSessionPayload?.params.scopedProperties,
      );
      expect(sessionA.sessionProperties).to.deep.equal(
        approveSessionPayload?.params.sessionProperties,
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
      expect(clients.A.core.expirer.keys).to.deep.equal(clients.B.core.expirer.keys);
      expect(clients.A.core.expirer.keys.length).to.eq(2);
      expect(clients.B.core.expirer.keys.length).to.eq(2);

      await deleteClients(clients);
    });
    it("should set scopedProperties in session", async () => {
      const clients = await initTwoClients();
      const requestedScopedProperties = {
        [Object.keys(TEST_CONNECT_PARAMS.requiredNamespaces)[0]]: "test",
      };
      const approvedScopedProperties = {
        polkadot: "approved",
      };
      const { uri, approval } = await clients.A.connect({
        ...TEST_CONNECT_PARAMS,
        scopedProperties: requestedScopedProperties,
      });
      if (!uri) throw new Error("URI is undefined");

      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_proposal", async (params) => {
            const { scopedProperties } = params.params;
            expect(scopedProperties).to.exist;
            expect(scopedProperties).to.deep.equal(requestedScopedProperties);

            await clients.B.approve({
              id: params.id,
              namespaces: TEST_NAMESPACES,
              scopedProperties: approvedScopedProperties,
            });
            resolve();
          });
        }),
        clients.B.pair({ uri }),
        approval(),
      ]);
      const dappSession = clients.A.session.getAll()[0];
      const walletSession = clients.B.session.getAll()[0];
      expect(dappSession.scopedProperties).to.deep.equal(approvedScopedProperties);
      expect(walletSession.scopedProperties).to.deep.equal(approvedScopedProperties);
      expect(dappSession.topic).to.eq(walletSession.topic);

      await deleteClients(clients);
    });
    it("should assign requiredNamespaces to optionalNamespaces", async () => {
      const clients = await initTwoClients();
      const requestedRequiredNamespaces = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          methods: ["eth_sendTransaction", "eth_sign"],
          events: ["chainChanged", "accountsChanged"],
        },
      };
      const { uri, approval } = await clients.A.connect({
        requiredNamespaces: requestedRequiredNamespaces,
      });
      if (!uri) throw new Error("URI is undefined");

      const session = await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_proposal", async (params) => {
            const { requiredNamespaces, optionalNamespaces } = params.params;

            expect(requiredNamespaces).to.deep.equal({});
            expect(optionalNamespaces).to.deep.equal(requestedRequiredNamespaces);

            await clients.B.approve({
              id: params.id,
              namespaces: TEST_NAMESPACES,
            });
            resolve();
          });
        }),
        clients.B.pair({ uri }),
        approval(),
      ]).then((res) => {
        return res[2];
      });
      expect(session.requiredNamespaces).to.deep.equal({});
      expect(session.optionalNamespaces).to.deep.equal(requestedRequiredNamespaces);
      await deleteClients(clients);
    });

    it("should save attestation and encryptedId in pending proposal", async () => {
      const clients = await initTwoClients();
      const requestedRequiredNamespaces = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          methods: ["eth_sendTransaction", "eth_sign"],
          events: ["chainChanged", "accountsChanged"],
        },
      };
      const { uri } = await clients.A.connect({
        requiredNamespaces: requestedRequiredNamespaces,
      });
      if (!uri) throw new Error("URI is undefined");

      const attestation = "attestation";
      const encryptedId = "encryptedId";

      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_proposal", (params) => {
            const { id } = params.params;

            const proposal = clients.A.proposal.get(id);
            expect(proposal).to.exist;
            expect(proposal.attestation).to.be.undefined;
            expect(proposal.encryptedId).to.be.undefined;
            clients.A.proposal.set(id, {
              ...proposal,
              attestation,
              encryptedId,
            });

            resolve();
          });
        }),
        clients.B.pair({ uri }),
      ]);

      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_proposal", (params) => {
            const { id } = params.params;
            const proposal = clients.A.proposal.get(id);
            expect(proposal).to.exist;
            expect(proposal.attestation).to.equal(attestation);
            expect(proposal.encryptedId).to.equal(encryptedId);
            resolve();
          });
        }),
        clients.B.pair({ uri }),
      ]);

      await deleteClients(clients);
    });
    it("should connect with out of order URIs", async () => {
      const clients = await initTwoClients();
      // load three proposals
      const { uri: uriOne, approval: approvalOne } = await clients.A.connect(TEST_CONNECT_PARAMS);
      const { uri: uriTwo, approval: approvalTwo } = await clients.A.connect(TEST_CONNECT_PARAMS);
      const { uri: uriThree, approval: approvalThree } =
        await clients.A.connect(TEST_CONNECT_PARAMS);

      if (!uriOne || !uriTwo || !uriThree) throw new Error("URI is undefined");

      const wallet = clients.B;

      const onSessionPropose = async (params) => {
        await wallet.approve({ id: params.id, namespaces: TEST_NAMESPACES });
      };
      wallet.on("session_proposal", onSessionPropose);

      // approve the oldest
      const sessionOne = await Promise.all([approvalOne(), wallet.pair({ uri: uriOne })]).then(
        (result) => result[0],
      );
      // approve the newest
      const sessionThree = await Promise.all([
        approvalThree(),
        wallet.pair({ uri: uriThree }),
      ]).then((result) => result[0]);
      // approve the middle
      const sessionTwo = await Promise.all([approvalTwo(), wallet.pair({ uri: uriTwo })]).then(
        (result) => result[0],
      );

      wallet.off("session_proposal", onSessionPropose);

      expect(sessionOne).to.exist;
      expect(sessionTwo).to.exist;
      expect(sessionThree).to.exist;
      expect(sessionOne.topic).to.not.eq(sessionTwo.topic);
      expect(sessionOne.topic).to.not.eq(sessionThree.topic);
      expect(sessionTwo.topic).to.not.eq(sessionThree.topic);
      expect(wallet.session.getAll().length).to.eq([sessionOne, sessionTwo, sessionThree].length);
      expect(wallet.session.get(sessionOne.topic)).to.exist;
      expect(wallet.session.get(sessionTwo.topic)).to.exist;
      expect(wallet.session.get(sessionThree.topic)).to.exist;

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
      expect(clients.A.session.getAll().length).to.eq(0);
      await throttle(2_000);
      expect(clients.B.session.getAll().length).to.eq(0);
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
      const dapp = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "dapp",
        metadata: TEST_APP_METADATA_A,
      });
      const wallet = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "wallet",
        metadata: TEST_WALLET_METADATA,
      });
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
      const dapp = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "dapp",
        metadata: TEST_APP_METADATA_A,
      });
      const wallet = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "wallet",
        metadata: TEST_WALLET_METADATA,
      });
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
    it.skip("should use rejected tag for session_propose", async () => {
      const dapp = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "dapp",
        metadata: TEST_APP_METADATA_A,
      });
      const wallet = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "wallet",
        metadata: TEST_WALLET_METADATA,
      });
      const { uri } = await dapp.connect(TEST_CONNECT_PARAMS);
      if (!uri) throw new Error("URI is undefined");
      expect(uri).to.exist;
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.core.relayer.on(RELAYER_EVENTS.publish, (payload) => {
            const { opts } = payload;
            const expectedOpts = ENGINE_RPC_OPTS.wc_sessionPropose.reject;
            expect(opts).to.exist;
            if (
              opts.tag === expectedOpts?.tag &&
              opts.ttl === expectedOpts?.ttl &&
              opts.prompt === expectedOpts?.prompt
            ) {
              resolve();
            }
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

  describe.concurrent("disconnect", () => {
    describe.concurrent("pairing", () => {
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
    describe.concurrent("session", () => {
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
    describe.concurrent("deeplinks", () => {
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
    describe.concurrent("request queue", () => {
      it("should reset request queue state on disconnect", async () => {
        const {
          clients,
          sessionA: { topic },
        } = await initTwoPairedClients({}, {}, { logger: "error" });
        await Promise.all([
          new Promise<void>((resolve) => {
            clients.B.once("session_delete", () => {
              expect(clients.B.pendingRequest.getAll().length).to.eq(0);
              // @ts-expect-error - sessionRequestQueue is private property
              expect(clients.B.engine.sessionRequestQueue.state).to.eq(ENGINE_QUEUE_STATES.idle);
              resolve();
            });
          }),
          new Promise<void>((resolve) => {
            clients.B.once("session_request", async (params) => {
              expect(clients.B.pendingRequest.getAll().length).to.eq(1);

              // @ts-expect-error - sessionRequestQueue is private property
              expect(clients.B.engine.sessionRequestQueue.state).to.eq(ENGINE_QUEUE_STATES.active);
              await clients.A.disconnect({ topic, reason: getSdkError("USER_DISCONNECTED") });
              resolve();
            });
            clients.A.request({
              topic,
              ...TEST_REQUEST_PARAMS,
            }).catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
            });
          }),
        ]);
        await deleteClients(clients);
      });
    });
  });

  describe.concurrent("ping", () => {
    it("throws if the topic is not a known pairing or session topic", async () => {
      const clients = await initTwoClients();
      const fakeTopic = "nonsense";
      await expect(clients.A.ping({ topic: fakeTopic })).rejects.toThrowError(
        `No matching key. session or pairing topic doesn't exist: ${fakeTopic}`,
      );
      await deleteClients(clients);
    });
    describe.concurrent("pairing", () => {
      describe.concurrent("with existing pairing", () => {
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
    describe.concurrent("session", () => {
      describe.concurrent("with existing session", () => {
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

        it("can set evm tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                eip155: {
                  methods: ["eth_sendTransaction", "wallet_sendCalls"],
                  events: [],
                  chains: ["eip155:1"],
                },
              },
              namespaces: {
                eip155: {
                  methods: ["eth_sendTransaction", "wallet_sendCalls"],
                  events: [],
                  chains: ["eip155:1"],
                  accounts: ["eip155:1:0x"],
                },
              },
            },
          );

          // eip155 eth_sendTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, "0x");
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  checkedWalletPublish = true;
                  const tvf = publishPayload.params;
                  expect(tvf).to.exist;
                  expect(tvf?.chainId).to.eq(params.chainId);
                  expect(tvf?.rpcMethods).to.eql([params.request.method]);
                  expect(tvf?.txHashes).to.eql([result.result]);
                  expect(tvf?.contractAddresses).to.eql([params.request.params[0].to]);

                  if (!tvf) {
                    return console.error("eip155 tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("eip155 tvf is missing required fields");
                  }
                  if (tvf.txHashes[0] !== result.result) {
                    return console.error(
                      "eip155 txHashes do not match: signature - eth_sendTransaction",
                      tvf.txHashes[0],
                      result.result,
                      id,
                    );
                  }

                  checkedWalletPublish = true;
                });
                await clients.B.respond({
                  topic,
                  response: result,
                });
                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "eth_sendTransaction",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // eip155 wallet_sendCalls example 1 { id: "0x" }
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, { id: "0x" });
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  checkedWalletPublish = true;
                  const tvf = publishPayload.params;

                  expect(tvf).to.exist;
                  expect(tvf?.chainId).to.eq(params.chainId);
                  expect(tvf?.rpcMethods).to.eql([params.request.method]);
                  expect(tvf?.txHashes).to.eql([result.result.id]);
                  expect(tvf?.contractAddresses).to.eql([params.request.params[0].to]);

                  if (!tvf) {
                    return console.error("eip155 tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("eip155 tvf is missing required fields");
                  }
                  if (tvf.txHashes[0] !== result.result.id) {
                    return console.error(
                      "eip155 txHashes do not match: wallet_sendCalls",
                      tvf.txHashes[0],
                      result.result,
                      id,
                    );
                  }

                  checkedWalletPublish = true;
                });
                await clients.B.respond({
                  topic,
                  response: result,
                });
                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "wallet_sendCalls",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // eip155 wallet_sendCalls example 2 { id: "0x", capabilities: { caip345: { transactionHashes: ["0x1"] } } }
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, {
                  id: "0x",
                  capabilities: { caip345: { transactionHashes: ["0x1"] } },
                });
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  checkedWalletPublish = true;
                  const tvf = publishPayload.params;

                  expect(tvf).to.exist;
                  expect(tvf?.chainId).to.eq(params.chainId);
                  expect(tvf?.rpcMethods).to.eql([params.request.method]);
                  expect(tvf?.txHashes).to.eql(["0x", "0x1"]);
                  expect(tvf?.contractAddresses).to.eql([params.request.params[0].to]);

                  if (!tvf) {
                    return console.error("eip155 tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("eip155 tvf is missing required fields");
                  }
                  if (
                    tvf.txHashes[0] !== result.result.id &&
                    tvf.txHashes[1] !== result.result.capabilities.caip345.transactionHashes[0]
                  ) {
                    return console.error(
                      "eip155 txHashes do not match: wallet_sendCalls",
                      tvf.txHashes,
                      result.result,
                      id,
                    );
                  }

                  checkedWalletPublish = true;
                });
                await clients.B.respond({
                  topic,
                  response: result,
                });
                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "wallet_sendCalls",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // eip155 wallet_sendCalls example 3 `0x`
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, "0x");
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  checkedWalletPublish = true;
                  const tvf = publishPayload.params;

                  expect(tvf).to.exist;
                  expect(tvf?.chainId).to.eq(params.chainId);
                  expect(tvf?.rpcMethods).to.eql([params.request.method]);
                  expect(tvf?.txHashes).to.eql([result.result]);
                  expect(tvf?.contractAddresses).to.eql([params.request.params[0].to]);

                  if (!tvf) {
                    return console.error("eip155 tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("eip155 tvf is missing required fields");
                  }
                  if (tvf.txHashes[0] !== result.result) {
                    return console.error(
                      "eip155 txHashes do not match: wallet_sendCalls",
                      tvf.txHashes[0],
                      result.result,
                      id,
                    );
                  }

                  checkedWalletPublish = true;
                });
                await clients.B.respond({
                  topic,
                  response: result,
                });
                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "wallet_sendCalls",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("can set solana tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                solana: {
                  methods: [
                    "solana_signTransaction",
                    "solana_signAllTransactions",
                    "solana_signAndSendTransaction",
                  ],
                  events: [],
                  chains: ["solana:devnet"],
                },
              },
              namespaces: {
                solana: {
                  methods: [
                    "solana_signTransaction",
                    "solana_signAllTransactions",
                    "solana_signAndSendTransaction",
                  ],
                  events: [],
                  chains: ["solana:devnet"],
                  accounts: ["solana:devnet:0x"],
                },
              },
            },
          );

          // solana solana_signAndSendTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, { signature: "0xSignature" });
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  console.log("tvf", tvf);
                  if (!tvf) {
                    return console.error("solana tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("solana tvf is missing required fields");
                  }
                  if (tvf.txHashes[0] !== result.result.signature) {
                    return console.error(
                      "solana txHashes do not match: signature - solana_signAndSendTransaction",
                      tvf.txHashes[0],
                      result.result.signature,
                      id,
                    );
                  }
                  checkedWalletPublish = true;
                });
                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "solana_signAndSendTransaction",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "solana:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // solana solana_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, { signature: "0xSignature" });
                let checkedWalletPublish = false;

                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("solana tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("solana tvf is missing required fields");
                  }
                  if (tvf.txHashes[0] !== result.result.signature) {
                    return console.error(
                      "solana txHashes do not match: signature",
                      tvf.txHashes[0],
                      result.result.signature,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "solana_signTransaction",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "solana:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // solana solana_signAllTransactions example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, {
                  transactions: [
                    "AeJw688VKMWEeOHsYhe03By/2rqJHTQeq6W4L1ZLdbT2l/Nim8ctL3erMyH9IWPsQP73uaarRmiVfanEJHx7uQ4BAAIDb3ObYkq6BFd46JrMFy1h0Q+dGmyRGtpelqTKkIg82isAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAAtIy17v5fs39LuoitzpBhVrg8ZIQF/3ih1N9dQ+X3shEDAgAFAlgCAAABAgAADAIAAACghgEAAAAAAAIACQMjTgAAAAAAAA==",
                    "AeJw688VKMWEeOHsYhe03By/2rqJHTQeq6W4L1ZLdbT2l/Nim8ctL3erMyH9IWPsQP73uaarRmiVfanEJHx7uQ4BAAIDb3ObYkq6BFd46JrMFy1h0Q+dGmyRGtpelqTKkIg82isAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAAtIy17v5fs39LuoitzpBhVrg8ZIQF/3ih1N9dQ+X3shEDAgAFAlgCAAABAgAADAIAAACghgEAAAAAAAIACQMjTgAAAAAAAA==",
                    "AeJw688VKMWEeOHsYhe03By/2rqJHTQeq6W4L1ZLdbT2l/Nim8ctL3erMyH9IWPsQP73uaarRmiVfanEJHx7uQ4BAAIDb3ObYkq6BFd46JrMFy1h0Q+dGmyRGtpelqTKkIg82isAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAAtIy17v5fs39LuoitzpBhVrg8ZIQF/3ih1N9dQ+X3shEDAgAFAlgCAAABAgAADAIAAACghgEAAAAAAAIACQMjTgAAAAAAAA==",
                  ],
                });
                const expectedTxHashes = [
                  "5XanD5KnkqzH3RjyqHzPCSRrNXYW2ADH4bge4oMi9KnDBrkFvugagH3LytFZFmBhZEEcyxPsZqeyF4cgLpEXVFR7",
                  "5XanD5KnkqzH3RjyqHzPCSRrNXYW2ADH4bge4oMi9KnDBrkFvugagH3LytFZFmBhZEEcyxPsZqeyF4cgLpEXVFR7",
                  "5XanD5KnkqzH3RjyqHzPCSRrNXYW2ADH4bge4oMi9KnDBrkFvugagH3LytFZFmBhZEEcyxPsZqeyF4cgLpEXVFR7",
                ];
                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("solana tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("solana tvf is missing required fields");
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "solana txHashes do not match: transactions",
                      tvf.txHashes,
                      result.result.transactions,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "solana_signAllTransactions",
                params: [
                  {
                    data: "0xa9059cbb00000000000000000000000013a2ff792037aa2cd77fe1f4b522921ac59a9c5200000000000000000000000000000000000000000000000000000000003d0900",
                    from: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
                    to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "solana:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("can set sui tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                sui: {
                  methods: ["sui_signTransaction", "sui_signAndExecuteTransaction"],
                  events: [],
                  chains: ["sui:devnet"],
                },
              },

              namespaces: {
                sui: {
                  methods: ["sui_signTransaction", "sui_signAndExecuteTransaction"],
                  events: [],
                  chains: ["sui:devnet"],
                  accounts: ["sui:devnet:0x"],
                },
              },
            },
          );
          // sui sui_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, {
                  transactionBytes:
                    "AAACAAhkAAAAAAAAAAAg1fZH7bd9T9ox0DBFBkR/s8kuVar3e8XtS3fDMt1GBfoCAgABAQAAAQEDAAAAAAEBANX2R+23fU/aMdAwRQZEf7PJLlWq93vF7Ut3wzLdRgX6At/pRJzj2VpZgqXpSvEtd3GzPvt99hR8e/yOCGz/8nbRmA7QFAAAAAAgBy5vStJizn76LmJTBlDiONdR/2rSuzzS4L+Tp/Zs4hZ8cBxYkcSlxBD6QXvgS11E6d+DNek8LiA/beba6iH3l5gO0BQAAAAAIMpdmZjiqJ5GG9di1MAgD4S3uRr2gaMC7S1WsaeBwNIx1fZH7bd9T9ox0DBFBkR/s8kuVar3e8XtS3fDMt1GBfroAwAAAAAAAECrPAAAAAAAAA==",
                });
                const expectedTxHashes = ["C98G1Uwh5soPMtZZmjUFwbVzWLMoAHzi5jrX2BtABe8v"];
                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("sui tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("sui tvf is missing required fields");
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "sui txHashes do not match: transactionBytes",
                      tvf.txHashes,
                      result.result.transactionBytes,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "sui_signTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "sui:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // sui sui_signAndExecuteTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["C98G1Uwh5soPMtZZmjUFwbVzWLMoAHzi5jrX2BtABe8v"];
                const result = formatJsonRpcResult(id, {
                  digest: expectedTxHashes[0],
                });

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("sui tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("sui tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "sui_signAndExecuteTransaction"
                  ) {
                    return console.error("sui tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "sui txHashes do not match: digest",
                      tvf.txHashes,
                      result.result.digest,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "sui_signAndExecuteTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "sui:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);
          await throttle(1_000);
          await deleteClients(clients);
        });
        it("can set hedera tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                hedera: {
                  methods: ["hedera_signAndExecuteTransaction", "hedera_executeTransaction"],
                  events: [],
                  chains: ["hedera:mainnet"],
                },
              },
              namespaces: {
                hedera: {
                  methods: ["hedera_signAndExecuteTransaction", "hedera_executeTransaction"],
                  events: [],
                  chains: ["hedera:mainnet"],
                  accounts: ["hedera:mainnet:0x"],
                },
              },
            },
          );

          // hedera hedera_signAndExecuteTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["0.0.12345678@1689281510.675369303"];
                const result = formatJsonRpcResult(id, {
                  transactionId: expectedTxHashes[0],
                });

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("hedera tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("hedera tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "hedera_signAndExecuteTransaction"
                  ) {
                    return console.error("hedera tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "hedera txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result.transactionId,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "hedera_signAndExecuteTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "hedera:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // hedera hedera_executeTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["0.0.12345678@1689281510.675369303"];
                const result = formatJsonRpcResult(id, {
                  transactionId: expectedTxHashes[0],
                });

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("hedera tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("hedera tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "hedera_signAndExecuteTransaction"
                  ) {
                    return console.error("hedera tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "hedera txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result.transactionId,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "hedera_executeTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "hedera:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set near tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                near: {
                  methods: ["near_signTransaction", "near_signTransactions"],
                  events: [],
                  chains: ["near:testnet"],
                },
              },
              namespaces: {
                near: {
                  methods: ["near_signTransaction", "near_signTransactions"],
                  events: [],
                  chains: ["near:testnet"],
                  accounts: ["near:testnet:0x"],
                },
              },
            },
          );

          // near near_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["EpHx79wKAn6br4G9aKaCGLpdzNc8YjrthiFonXQgskAx"];
                const signedTransaction = new Uint8Array([
                  16, 0, 0, 0, 48, 120, 103, 97, 110, 99, 104, 111, 46, 116, 101, 115, 116, 110,
                  101, 116, 0, 243, 74, 204, 31, 29, 80, 146, 149, 102, 175, 8, 83, 231, 187, 5,
                  120, 41, 115, 247, 22, 197, 120, 182, 242, 120, 135, 73, 137, 166, 246, 171, 103,
                  77, 243, 34, 42, 212, 180, 0, 0, 16, 0, 0, 0, 48, 120, 103, 97, 110, 99, 104, 111,
                  46, 116, 101, 115, 116, 110, 101, 116, 5, 233, 95, 227, 45, 10, 101, 176, 111,
                  124, 190, 86, 106, 27, 143, 54, 148, 125, 132, 252, 25, 71, 125, 78, 60, 242, 100,
                  219, 40, 168, 65, 3, 1, 0, 0, 0, 3, 0, 0, 0, 161, 237, 204, 206, 27, 194, 211, 0,
                  0, 0, 0, 0, 0,
                ]);

                const result = formatJsonRpcResult(id, signedTransaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("near tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("near tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "near_signTransaction") {
                    return console.error("near tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "near txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "near_signTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "near:testnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // near near_signTransactions example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = [
                  "EpHx79wKAn6br4G9aKaCGLpdzNc8YjrthiFonXQgskAx",
                  "EpHx79wKAn6br4G9aKaCGLpdzNc8YjrthiFonXQgskAx",
                ];
                const signedTransaction = new Uint8Array([
                  16, 0, 0, 0, 48, 120, 103, 97, 110, 99, 104, 111, 46, 116, 101, 115, 116, 110,
                  101, 116, 0, 243, 74, 204, 31, 29, 80, 146, 149, 102, 175, 8, 83, 231, 187, 5,
                  120, 41, 115, 247, 22, 197, 120, 182, 242, 120, 135, 73, 137, 166, 246, 171, 103,
                  77, 243, 34, 42, 212, 180, 0, 0, 16, 0, 0, 0, 48, 120, 103, 97, 110, 99, 104, 111,
                  46, 116, 101, 115, 116, 110, 101, 116, 5, 233, 95, 227, 45, 10, 101, 176, 111,
                  124, 190, 86, 106, 27, 143, 54, 148, 125, 132, 252, 25, 71, 125, 78, 60, 242, 100,
                  219, 40, 168, 65, 3, 1, 0, 0, 0, 3, 0, 0, 0, 161, 237, 204, 206, 27, 194, 211, 0,
                  0, 0, 0, 0, 0,
                ]);

                const result = formatJsonRpcResult(id, [signedTransaction, signedTransaction]);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("near tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("near tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "near_signTransactions"
                  ) {
                    return console.error("near tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "near txHashes do not match: transactionId",
                      tvf.txHashes,
                      expectedTxHashes,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "near_signTransactions",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "near:testnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set tron tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                tron: {
                  methods: ["tron_signTransaction"],
                  events: [],
                  chains: ["tron:mainnet"],
                },
              },
              namespaces: {
                tron: {
                  methods: ["tron_signTransaction"],
                  events: [],
                  chains: ["tron:mainnet"],
                  accounts: ["tron:mainnet:0x"],
                },
              },
            },
          );

          // tron tron_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["0x1234567890"];
                const transaction = {
                  txID: expectedTxHashes[0],
                };

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("tron tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("tron tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "tron_signTransaction") {
                    return console.error("tron tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "tron txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "tron_signTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "tron:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set xrpl tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                xrpl: {
                  methods: ["xrpl_signTransaction", "xrpl_signTransactionFor"],
                  events: [],
                  chains: ["xrpl:mainnet"],
                },
              },
              namespaces: {
                xrpl: {
                  methods: ["xrpl_signTransaction", "xrpl_signTransactionFor"],
                  events: [],
                  chains: ["xrpl:mainnet"],
                  accounts: ["xrpl:mainnet:0x"],
                },
              },
            },
          );

          // xrpl xrpl_signTransactionFor example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["0x1234567890"];
                const transaction = {
                  tx_json: {
                    hash: expectedTxHashes[0],
                  },
                };

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("xrpl tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("xrpl tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "xrpl_signTransactionFor"
                  ) {
                    return console.error("xrpl tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "xrpl txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "xrpl_signTransactionFor",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "xrpl:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set algorand tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                algorand: {
                  methods: ["algo_signTxn"],
                  events: [],
                  chains: ["algorand:mainnet"],
                },
              },
              namespaces: {
                algorand: {
                  methods: ["algo_signTxn"],
                  events: [],
                  chains: ["algorand:mainnet"],
                  accounts: ["algorand:mainnet:0x"],
                },
              },
            },
          );

          // algorand algo_signTxn example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["OM5JS3AE4HVAT5ZMCIMY32HPD6KJAQVPFS2LL2ZW2R5JKUKZFVNA"];
                const transaction = [
                  "gqNzaWfEQNGPgbxS9pTu0sTikT3cJVO48WFltc8MM8meFR+aAnGwOo3FO+0nFkAludT0jNqHRM6E65gW6k/m92sHVCxVnQWjdHhuiaNhbXTOAAehIKNmZWXNA+iiZnbOAv0CO6NnZW6sbWFpbm5ldC12MS4womdoxCDAYcTY/B293tLXYEvkVo4/bQQZh6w3veS2ILWrOSSK36Jsds4C/QYjo3JjdsQgeqRNTBEXudHx2kO9Btq289aRzj5DlNUw0jwX9KEnaZqjc25kxCDH1s5tvgARbjtHceUG07Sj5IDfqzn7Zwx0P+XuvCYMz6R0eXBlo3BheQ==",
                ];

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("algorand tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("algorand tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "algo_signTxn") {
                    return console.error("algorand tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "algorand txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "algo_signTxn",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "algorand:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set bip122 tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                bip122: {
                  methods: ["sendTransfer"],
                  events: [],
                  chains: ["bip122:mainnet"],
                },
              },
              namespaces: {
                bip122: {
                  methods: ["sendTransfer"],
                  events: [],
                  chains: ["bip122:mainnet"],
                  accounts: ["bip122:mainnet:0x"],
                },
              },
            },
          );

          // bip122 sendTransfer example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["OM5JS3AE4HVAT5ZMCIMY32HPD6KJAQVPFS2LL2ZW2R5JKUKZFVNA"];
                const transaction = {
                  txid: expectedTxHashes[0],
                };

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("bip122 tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("bip122 tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "sendTransfer") {
                    return console.error("bip122 tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "bip122 txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "sendTransfer",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "bip122:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set stacks tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                stacks: {
                  methods: ["stacks_stxTransfer"],
                  events: [],
                  chains: ["stacks:mainnet"],
                },
              },
              namespaces: {
                stacks: {
                  methods: ["stacks_stxTransfer"],
                  events: [],
                  chains: ["stacks:mainnet"],
                  accounts: ["stacks:mainnet:0x"],
                },
              },
            },
          );

          // stacks stacks_stxTransfer example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["OM5JS3AE4HVAT5ZMCIMY32HPD6KJAQVPFS2LL2ZW2R5JKUKZFVNA"];
                const transaction = {
                  txId: expectedTxHashes[0],
                };

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("stacks tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("stacks tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "stacks_stxTransfer") {
                    return console.error("stacks tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "stacks txHashes do not match: transactionId",
                      tvf.txHashes,
                      result.result,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "stacks_stxTransfer",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "stacks:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set polkadot tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                polkadot: {
                  methods: ["polkadot_signTransaction"],
                  events: [],
                  chains: ["polkadot:mainnet"],
                },
              },
              namespaces: {
                polkadot: {
                  methods: ["polkadot_signTransaction"],
                  events: [],
                  chains: ["polkadot:mainnet"],
                  accounts: ["polkadot:mainnet:0x"],
                },
              },
            },
          );

          // polkadot polkadot_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = [
                  "0x48016b3c80b7b61d32d1db6f52038de70d7d30ef948da047442cc9c952b92e84",
                ];
                const transaction = {
                  signature:
                    "362cef5dff66aee851a5d8c5100a53590eddd7c75c1a53553b08861fb28ce80b96d53279f52a27c866639954c5efa32b52c148fefe78dbdad1f9d3be4f44538f",
                };

                const result = formatJsonRpcResult(id, transaction);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("polkadot tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("polkadot tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "polkadot_signTransaction"
                  ) {
                    return console.error("polkadot tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "polkadot txHashes do not match: transactionId",
                      tvf.txHashes,
                      expectedTxHashes,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "polkadot_signTransaction",
                params: {
                  address: "15JBFhDp1rQycRFuCtkr2VouMiWyDzh3qRUPA8STY53mdRmM",
                  transactionPayload: {
                    method:
                      "050300c07d211d3c181df768d9d9d41df6f14f9d116d9c1906f38153b208259c315b4b02286bee",
                    specVersion: "c9550f00",
                    transactionVersion: "1a000000",
                    genesisHash: "91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
                    blockHash: "130d8c27af0e0adfa85d370af89746f229780b677c81da97d11a4921cdb86df5",
                    era: "1502",
                    nonce: "1c",
                    tip: "00",
                    mode: "00",
                    metadataHash: "00",
                    address: "15JBFhDp1rQycRFuCtkr2VouMiWyDzh3qRUPA8STY53mdRmM",
                    version: 4,
                  },
                },
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "polkadot:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("it can set cosmos tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                cosmos: {
                  methods: ["cosmos_signDirect"],
                  events: [],
                  chains: ["cosmos:mainnet"],
                },
              },
              namespaces: {
                cosmos: {
                  methods: ["cosmos_signDirect"],
                  events: [],
                  chains: ["cosmos:mainnet"],
                  accounts: ["cosmos:mainnet:0x"],
                },
              },
            },
          );

          // cosmos cosmos_signDirect example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = [
                  "A7284BA475C55983E5BCB7D52F5C82CBFF19FD75725F5E0E33BA4384FCFC6052",
                ];
                const signedResult = {
                  signature: {
                    pub_key: {
                      type: "tendermint/PubKeySecp256k1",
                      value: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
                    },
                    signature:
                      "S7BJEbiXQ6vxvF9o4Wj7qAcocMQqBsqz+NVH4wilhidFsRpyqpSP5XiXoQZxTDrT9uET/S5SH6+5gUmjYntH/Q==",
                  },
                  signed: {
                    chainId: "cosmoshub-4",
                    accountNumber: "1",
                    authInfoBytes:
                      "ClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDNOXj4u60JFq00+VbLBCNBTYy76Pn864AvYNFG/9cQwMSBAoCCH8YAhITCg0KBXVhdG9tEgQ0NTM1EIaJCw==",
                    bodyBytes:
                      "CpoICikvaWJjLmFwcGxpY2F0aW9ucy50cmFuc2Zlci52MS5Nc2dUcmFuc2ZlchLsBwoIdHJhbnNmZXISC2NoYW5uZWwtMTQxGg8KBXVhdG9tEgYxODg4MDYiLWNvc21vczFhanBkZndsZmRqY240MG5yZXN5ZHJxazRhOGo2ZG0wemY0MGszcSo/b3NtbzEwYTNrNGh2azM3Y2M0aG54Y3R3NHA5NWZoc2NkMno2aDJybXgwYXVrYzZybTh1OXFxeDlzbWZzaDd1MgcIARDFt5YRQsgGeyJ3YXNtIjp7ImNvbnRyYWN0Ijoib3NtbzEwYTNrNGh2azM3Y2M0aG54Y3R3NHA5NWZoc2NkMno2aDJybXgwYXVrYzZybTh1OXFxeDlzbWZzaDd1IiwibXNnIjp7InN3YXBfYW5kX2FjdGlvbiI6eyJ1c2VyX3N3YXAiOnsic3dhcF9leGFjdF9hc3NldF9pbiI6eyJzd2FwX3ZlbnVlX25hbWUiOiJvc21vc2lzLXBvb2xtYW5hZ2VyIiwib3BlcmF0aW9ucyI6W3sicG9vbCI6IjE0MDAiLCJkZW5vbV9pbiI6ImliYy8yNzM5NEZCMDkyRDJFQ0NENTYxMjNDNzRGMzZFNEMxRjkyNjAwMUNFQURBOUNBOTdFQTYyMkIyNUY0MUU1RUIyIiwiZGVub21fb3V0IjoidW9zbW8ifSx7InBvb2wiOiIxMzQ3IiwiZGVub21faW4iOiJ1b3NtbyIsImRlbm9tX291dCI6ImliYy9ENzlFN0Q4M0FCMzk5QkZGRjkzNDMzRTU0RkFBNDgwQzE5MTI0OEZDNTU2OTI0QTJBODM1MUFFMjYzOEIzODc3In1dfX0sIm1pbl9hc3NldCI6eyJuYXRpdmUiOnsiZGVub20iOiJpYmMvRDc5RTdEODNBQjM5OUJGRkY5MzQzM0U1NEZBQTQ4MEMxOTEyNDhGQzU1NjkyNEEyQTgzNTFBRTI2MzhCMzg3NyIsImFtb3VudCI6IjMzOTQ2NyJ9fSwidGltZW91dF90aW1lc3RhbXAiOjE3NDc3NDY3MzM3OTU4OTgzNjQsInBvc3Rfc3dhcF9hY3Rpb24iOnsiaWJjX3RyYW5zZmVyIjp7ImliY19pbmZvIjp7InNvdXJjZV9jaGFubmVsIjoiY2hhbm5lbC02OTk0IiwicmVjZWl2ZXIiOiJjZWxlc3RpYTFhanBkZndsZmRqY240MG5yZXN5ZHJxazRhOGo2ZG0wemNsN3h0ZCIsIm1lbW8iOiIiLCJyZWNvdmVyX2FkZHJlc3MiOiJvc21vMWFqcGRmd2xmZGpjbjQwbnJlc3lkcnFrNGE4ajZkbTB6cHd1eDhqIn19fSwiYWZmaWxpYXRlcyI6W119fX19",
                  },
                };

                const result = formatJsonRpcResult(id, signedResult);

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("cosmos tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("cosmos tvf is missing required fields");
                  }
                  if (tvf.rpcMethods.length !== 1 && tvf.rpcMethods[0] !== "cosmos_signDirect") {
                    return console.error("cosmos tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "cosmos txHashes do not match: transactionId",
                      tvf.txHashes,
                      expectedTxHashes,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "cosmos_signDirect",
                params: {},
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "cosmos:mainnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          await throttle(1_000);
          await deleteClients(clients);
        });
        it("can set sui tvf params", async () => {
          const {
            clients,
            sessionA: { topic },
          } = await initTwoPairedClients(
            {},
            {},
            { logger: "error" },
            {
              requiredNamespaces: {
                sui: {
                  methods: ["sui_signTransaction", "sui_signAndExecuteTransaction"],
                  events: [],
                  chains: ["sui:devnet"],
                },
              },
              namespaces: {
                sui: {
                  methods: ["sui_signTransaction", "sui_signAndExecuteTransaction"],
                  events: [],
                  chains: ["sui:devnet"],
                  accounts: ["sui:devnet:0x"],
                },
              },
            },
          );

          // sui sui_signTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);

                const result = formatJsonRpcResult(id, {
                  transactionBytes:
                    "AAACAAhkAAAAAAAAAAAg1fZH7bd9T9ox0DBFBkR/s8kuVar3e8XtS3fDMt1GBfoCAgABAQAAAQEDAAAAAAEBANX2R+23fU/aMdAwRQZEf7PJLlWq93vF7Ut3wzLdRgX6At/pRJzj2VpZgqXpSvEtd3GzPvt99hR8e/yOCGz/8nbRmA7QFAAAAAAgBy5vStJizn76LmJTBlDiONdR/2rSuzzS4L+Tp/Zs4hZ8cBxYkcSlxBD6QXvgS11E6d+DNek8LiA/beba6iH3l5gO0BQAAAAAIMpdmZjiqJ5GG9di1MAgD4S3uRr2gaMC7S1WsaeBwNIx1fZH7bd9T9ox0DBFBkR/s8kuVar3e8XtS3fDMt1GBfroAwAAAAAAAECrPAAAAAAAAA==",
                });
                const expectedTxHashes = ["C98G1Uwh5soPMtZZmjUFwbVzWLMoAHzi5jrX2BtABe8v"];
                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("sui tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("sui tvf is missing required fields");
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "sui txHashes do not match: transactionBytes",
                      tvf.txHashes,
                      result.result.transactionBytes,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "sui_signTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "sui:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
            }),
          ]);

          // sui sui_signAndExecuteTransaction example
          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.once("session_request", async (args) => {
                const pendingRequests = clients.B.pendingRequest.getAll();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                const expectedTxHashes = ["C98G1Uwh5soPMtZZmjUFwbVzWLMoAHzi5jrX2BtABe8v"];
                const result = formatJsonRpcResult(id, {
                  digest: expectedTxHashes[0],
                });

                let checkedWalletPublish = false;
                clients.B.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                  const tvf = publishPayload.params;
                  if (!tvf) {
                    return console.error("sui tvf is undefined");
                  }
                  if (!tvf.chainId || !tvf.rpcMethods || !tvf.txHashes) {
                    return console.error("sui tvf is missing required fields");
                  }
                  if (
                    tvf.rpcMethods.length !== 1 &&
                    tvf.rpcMethods[0] !== "sui_signAndExecuteTransaction"
                  ) {
                    return console.error("sui tvf rpcMethods is invalid", tvf.rpcMethods);
                  }
                  if (tvf.txHashes.join(",") !== expectedTxHashes.join(",")) {
                    return console.error(
                      "sui txHashes do not match: digest",
                      tvf.txHashes,
                      result.result.digest,
                    );
                  }

                  checkedWalletPublish = true;
                });

                await clients.B.respond({
                  topic,
                  response: result,
                });

                expect(checkedWalletPublish).to.be.true;
                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              const requestParams = {
                method: "sui_signAndExecuteTransaction",
                params: [
                  {
                    data: "0xdeadbeef",
                  },
                ],
              };
              let checkedDappPublish = false;

              clients.A.core.relayer.once(RELAYER_EVENTS.publish, (publishPayload: any) => {
                checkedDappPublish = true;
                const tvf = publishPayload.params;
                expect(tvf).to.exist;
                expect(tvf?.chainId).to.eq(TEST_REQUEST_PARAMS.chainId);
                expect(tvf?.rpcMethods).to.eql([requestParams.method]);
                expect(tvf?.txHashes).to.be.undefined;
                expect(tvf?.contractAddresses).to.eql([requestParams.params[0].to]);
              });

              await clients.A.request({
                topic,
                ...TEST_REQUEST_PARAMS,
                request: {
                  ...TEST_REQUEST_PARAMS.request,
                  ...requestParams,
                },
                chainId: "sui:devnet",
              });
              expect(checkedDappPublish).to.be.true;
              resolve();
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
                }).catch((e) => {
                  console.error(e);
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
              }).catch((e) => {
                console.error(e);
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
            }).catch((e) => {
              console.error(e);
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
                    }).catch((e) => {
                      console.error(e);
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
  describe.concurrent("update", () => {
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

  describe.concurrent("namespaces", () => {
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

  describe.concurrent("session requests", () => {
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

    it("should throw an error when responding to request on mismatched topic", async () => {
      const {
        clients,
        sessionA: { topic },
      } = await initTwoPairedClients({}, {}, { logger: "error" });
      await clients.B.session.set("0xdeadbeef", clients.B.session.get(topic));
      clients.B.core.crypto.keychain.set("0xdeadbeef", {} as any);
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.B.once("session_request", async (payload) => {
            const { params } = payload;
            expect(params).toMatchObject(TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE);
            try {
              // should throw an error
              await clients.B.respond({
                topic: "0xdeadbeef",
                response: formatJsonRpcResult(payload.id, "test response"),
              });
            } catch (err) {
              const message = (err as Error).message;
              expect(message).toMatch(
                "Request response topic mismatch. reqId: " +
                  payload.id +
                  ", expected topic: " +
                  topic +
                  ", received topic: 0xdeadbeef",
              );
              // @ts-expect-error - private property
              const errorEvents = clients.B.core.eventClient.events;
              expect(errorEvents.size).to.eq(1);
              const event = Array.from(errorEvents.values())[0] as any;
              expect(event.props.event).to.eq("ERROR");
              expect(event.props.type).to.eq(
                EVENT_CLIENT_SESSION_ERRORS.session_request_response_validation_failure,
              );
              expect(event.props.properties.topic).to.eq("0xdeadbeef");
            }
            // should respond to the request on the correct topic
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
        optionalNamespaces: TEST_REQUIRED_NAMESPACES_V2,
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
  describe.concurrent("Events Client", () => {
    it("should set missing event listener error type", async () => {
      const clients = await initTwoClients();
      const { uri } = await clients.A.connect({});
      if (!uri) throw new Error("URI is undefined");
      await clients.B.pair({ uri });
      const { topic } = parseUri(uri);
      expect(clients.B.core.eventClient.events.size).to.eq(1);
      const event = clients.B.core.eventClient.getEvent({ topic });
      if (!event) throw new Error("Event is undefined");
      expect(event).to.exist;
      expect(event.props.event).to.eq("ERROR");
      expect(event.props.type).to.eq(""); // there is no type yet as no error has happened
      expect(event.props.properties.topic).to.eq(topic);
      expect(event.props.properties.trace).to.exist;
      expect(event.props.properties.trace.length).to.toBeGreaterThan(0);

      // wait for the proposal to be received
      await throttle(5_000);

      expect(event.props.type).to.eq(EVENT_CLIENT_PAIRING_ERRORS.proposal_listener_not_found);

      await deleteClients(clients);
    });
    it("should create event during approve session flow when proposal is not found", async () => {
      const wallet = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "wallet",
        metadata: TEST_WALLET_METADATA,
      });

      await expect(wallet.approve({ id: 123, namespaces: TEST_NAMESPACES })).rejects.toThrowError();
      expect(wallet.core.eventClient.events.size).to.eq(1);
      const event = wallet.core.eventClient.getEvent({ topic: "123" });
      if (!event) throw new Error("Event is undefined");
      expect(event).to.exist;
      expect(event.props.event).to.eq("ERROR");
      expect(event.props.type).to.eq(EVENT_CLIENT_SESSION_ERRORS.proposal_not_found);
      expect(event.props.properties.topic).to.eq("123");
      expect(event.props.properties.trace).to.exist;
      expect(event.props.properties.trace.length).to.toBeGreaterThan(0);
      await deleteClients({ A: wallet, B: undefined });
    });
    it("should create event during approve session flow and delete it on successful approve", async () => {
      const clients = await initTwoClients();
      const { uri } = await clients.A.connect({});
      if (!uri) throw new Error("URI is undefined");
      await clients.B.pair({ uri });
      const { topic } = parseUri(uri);
      expect(clients.B.core.eventClient.events.size).to.eq(1);
      const event = clients.B.core.eventClient.getEvent({ topic });
      if (!event) throw new Error("Event is undefined");
      expect(event).to.exist;
      expect(event.props.event).to.eq("ERROR");
      expect(event.props.type).to.eq(""); // there is no type yet as no error has happened
      expect(event.props.properties.topic).to.eq(topic);
      expect(event.props.properties.trace).to.exist;
      expect(event.props.properties.trace.length).to.toBeGreaterThan(0);

      await new Promise<void>((resolve) => {
        clients.B.once("session_proposal", async (params) => {
          // confirm the emit_session_proposal trace
          expect(event.props.properties.trace).to.include(
            EVENT_CLIENT_PAIRING_TRACES.emit_session_proposal,
          );
          await clients.B.approve({ id: params.id, namespaces: TEST_NAMESPACES });
          resolve();
        });
      });

      await throttle(2_000);

      // the event should be deleted
      expect(clients.B.core.eventClient.events.size).to.eq(0);

      await deleteClients(clients);
    });
  });
});
// don't use concurrency here as these tests change timeclock
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

  it("should create event during pairing flow", async () => {
    const clients = await initTwoClients();
    const { uri } = await clients.A.connect({});
    if (!uri) throw new Error("URI is undefined");
    await clients.B.pair({ uri });
    const { topic } = parseUri(uri);
    expect(clients.B.core.eventClient.events.size).to.eq(1);
    const event = clients.B.core.eventClient.getEvent({ topic });
    if (!event) throw new Error("Event is undefined");
    expect(event).to.exist;
    expect(event.props.event).to.eq("ERROR");
    expect(event.props.type).to.eq(""); // there is no type yet as no error has happened
    expect(event.props.properties.topic).to.eq(topic);
    expect(event.props.properties.trace).to.exist;
    expect(event.props.properties.trace.length).to.toBeGreaterThan(0);

    await new Promise<void>((resolve) => {
      clients.B.once("session_proposal", (params) => {
        resolve();
      });
    });

    expect(event.props.properties.trace).to.include(
      EVENT_CLIENT_PAIRING_TRACES.emit_session_proposal,
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.useFakeTimers({ shouldAdvanceTime: true, shouldClearNativeTimers: true });
    vi.setSystemTime(Date.now() + 60_000 * 6);
    await throttle(5_000);

    expect(event.props.type).to.eq(EVENT_CLIENT_PAIRING_ERRORS.proposal_expired);

    vi.useRealTimers();

    await deleteClients(clients);
  });
});
