/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { ENGINE_RPC_OPTS, SignClient } from "../../src";
import { TEST_APP_METADATA_B, TEST_SIGN_CLIENT_OPTIONS, deleteClients, throttle } from "../shared";
import {
  buildApprovedNamespaces,
  buildAuthObject,
  getSdkError,
  populateAuthPayload,
} from "@walletconnect/utils";
import { AuthTypes } from "@walletconnect/types";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { RELAYER_EVENTS } from "@walletconnect/core";

describe("Authenticated Sessions", () => {
  let cryptoWallet: CryptoWallet;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
  });
  // this test simulates the scenario where the wallet supports all the requested chains and methods
  // and replies with a single signature
  it("should establish authenticated session with single signature. Case 1", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      Promise.race<void>([
        new Promise((resolve) => {
          wallet.on("session_authenticate", async (payload) => {
            // validate that the dapp has both `session_authenticate` & `session_proposal` stored
            // and expirer configured
            const pendingProposals = dapp.proposal.getAll();
            expect(pendingProposals.length).to.eq(1);
            expect(dapp.core.expirer.keys).to.include(`id:${pendingProposals[0].id}`);
            expect(dapp.core.expirer.get(pendingProposals[0].id)).to.exist;
            expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.exist;
            expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.be.greaterThan(0);

            const pendingAuthRequests = dapp.auth.requests.getAll();
            expect(pendingAuthRequests.length).to.eq(1);
            expect(dapp.core.expirer.keys).to.include(`id:${pendingAuthRequests[0].id}`);
            expect(dapp.core.expirer.get(pendingAuthRequests[0].id)).to.exist;
            expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.exist;
            expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.be.greaterThan(0);
            expect(pendingAuthRequests[0].id).to.eq(payload.id);

            // validate that the wallet doesn't have any pending proposals
            const pendingProposalsWallet = wallet.proposal.getAll();
            expect(pendingProposalsWallet.length).to.eq(0);

            const authPayload = populateAuthPayload({
              authPayload: payload.params.authPayload,
              chains: requestedChains,
              methods: requestedMethods,
            });
            const iss = `${requestedChains[0]}:${cryptoWallet.address}`;
            const message = wallet.engine.formatAuthMessage({
              request: authPayload,
              iss,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              authPayload,
              {
                t: "eip191",
                s: sig,
              },
              iss,
            );
            await wallet.approveSessionAuthenticate({
              id: payload.id,
              auths: [auth],
            });
            resolve();
          });
        }),
        new Promise((_, reject) => {
          wallet.on("session_proposal", () => {
            reject(new Error("wallet should not emit session_proposal"));
          });
        }),
      ]),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const session = (await response()).session;
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    // confirm that all pending proposals and auth requests have been cleared
    expect(wallet.proposal.getAll().length).to.eq(0);
    expect(wallet.auth.requests.getAll().length).to.eq(0);
    expect(dapp.proposal.getAll().length).to.eq(0);
    expect(dapp.auth.requests.getAll().length).to.eq(0);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports subset of the requested chains and all methods
  // and replies with a single signature
  it("should establish authenticated session with single signature. Case 2", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = [requestedChains[1]];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          // validate that the dapp has both `session_authenticate` & `session_proposal` stored
          // and expirer configured
          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          expect(dapp.core.expirer.keys).to.include(`id:${pendingProposals[0].id}`);
          expect(dapp.core.expirer.get(pendingProposals[0].id)).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.be.greaterThan(0);

          const pendingAuthRequests = dapp.auth.requests.getAll();
          expect(pendingAuthRequests.length).to.eq(1);
          expect(dapp.core.expirer.keys).to.include(`id:${pendingAuthRequests[0].id}`);
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)).to.exist;
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.exist;
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.be.greaterThan(0);
          expect(pendingAuthRequests[0].id).to.eq(payload.id);

          // validate that the wallet doesn't have any pending proposals
          const pendingProposalsWallet = wallet.proposal.getAll();
          expect(pendingProposalsWallet.length).to.eq(0);

          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: requestedMethods,
          });
          const iss = `${supportedChains[0]}:${cryptoWallet.address}`;
          const message = wallet.engine.formatAuthMessage({
            request: authPayload,
            iss,
          });
          const sig = await cryptoWallet.signMessage(message);
          const auth = buildAuthObject(
            authPayload,
            {
              t: "eip191",
              s: sig,
            },
            iss,
          );
          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths: [auth],
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const session = (await response()).session;
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: supportedChains[0],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);
    // confirm that all pending proposals and auth requests have been cleared
    expect(wallet.proposal.getAll().length).to.eq(0);
    expect(wallet.auth.requests.getAll().length).to.eq(0);
    expect(dapp.proposal.getAll().length).to.eq(0);
    expect(dapp.auth.requests.getAll().length).to.eq(0);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports subset of the requested chains and methods
  // and replies with a single signature
  it("should establish authenticated session with single signature. Case 3", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = [requestedChains[1]];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const supportedMethods = [requestedMethods[0]];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          // validate that the dapp has both `session_authenticate` & `session_proposal` stored
          // and expirer configured
          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          expect(dapp.core.expirer.keys).to.include(`id:${pendingProposals[0].id}`);
          expect(dapp.core.expirer.get(pendingProposals[0].id)).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.be.greaterThan(0);

          const pendingAuthRequests = dapp.auth.requests.getAll();
          expect(pendingAuthRequests.length).to.eq(1);
          expect(dapp.core.expirer.keys).to.include(`id:${pendingAuthRequests[0].id}`);
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)).to.exist;
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.exist;
          expect(dapp.core.expirer.get(pendingAuthRequests[0].id)?.expiry).to.be.greaterThan(0);
          expect(pendingAuthRequests[0].id).to.eq(payload.id);

          // validate that the wallet doesn't have any pending proposals
          const pendingProposalsWallet = wallet.proposal.getAll();
          expect(pendingProposalsWallet.length).to.eq(0);

          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: supportedMethods,
          });
          const iss = `${supportedChains[0]}:${cryptoWallet.address}`;
          const message = wallet.engine.formatAuthMessage({
            request: authPayload,
            iss,
          });
          const sig = await cryptoWallet.signMessage(message);
          const auth = buildAuthObject(
            authPayload,
            {
              t: "eip191",
              s: sig,
            },
            iss,
          );
          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths: [auth],
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const session = (await response()).session;
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: supportedChains[0],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports all requested chains and subset of methods
  // and replies with a single signature
  it("should establish authenticated session with single signature. Case 4", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = requestedChains;
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const supportedMethods = [requestedMethods[0]];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: supportedMethods,
          });
          const iss = `${supportedChains[1]}:${cryptoWallet.address}`;
          const message = wallet.engine.formatAuthMessage({
            request: authPayload,
            iss,
          });
          const sig = await cryptoWallet.signMessage(message);
          const auth = buildAuthObject(
            authPayload,
            {
              t: "eip191",
              s: sig,
            },
            iss,
          );
          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths: [auth],
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const session = (await response()).session;
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        await dapp.request({
          chainId: supportedChains[1],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });

  // this test simulates the scenario where the wallet supports all the requested chains and methods
  it("should establish authenticated session with multiple signatures. Case 1", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: requestedChains,
            methods: requestedMethods,
          });

          const auths: AuthTypes.Cacao[] = [];
          authPayload.chains.forEach(async (chain) => {
            const iss = `${chain}:${cryptoWallet.address}`;
            const message = wallet.engine.formatAuthMessage({
              request: authPayload,
              iss,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              authPayload,
              {
                t: "eip191",
                s: sig,
              },
              iss,
            );
            auths.push(auth);
          });

          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { session, auths } = await response();
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    expect(auths?.length).to.eq(requestedChains.length);
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports subset of the requested chains and all methods
  it("should establish authenticated session with multiple signatures. Case 2", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = [requestedChains[1]];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: requestedMethods,
          });

          const auths: AuthTypes.Cacao[] = [];
          authPayload.chains.forEach(async (chain) => {
            const iss = `${chain}:${cryptoWallet.address}`;
            const message = wallet.engine.formatAuthMessage({
              request: authPayload,
              iss,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              authPayload,
              {
                t: "eip191",
                s: sig,
              },
              iss,
            );
            auths.push(auth);
          });

          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { session, auths } = await response();
    const walletSession = wallet.session.get(session.topic);
    expect(auths?.length).to.eq(supportedChains.length);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: supportedChains[0],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports subset of the requested chains and methods
  it("should establish authenticated session with multiple signatures. Case 3", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = [requestedChains[1]];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const supportedMethods = [requestedMethods[0]];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: supportedMethods,
          });
          const auths: AuthTypes.Cacao[] = [];
          authPayload.chains.forEach(async (chain) => {
            const iss = `${chain}:${cryptoWallet.address}`;
            const message = wallet.engine.formatAuthMessage({
              request: authPayload,
              iss,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              authPayload,
              {
                t: "eip191",
                s: sig,
              },
              iss,
            );
            auths.push(auth);
          });

          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { session, auths } = await response();
    const walletSession = wallet.session.get(session.topic);
    expect(auths?.length).to.eq(supportedChains.length);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: supportedChains[0],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });
  // this test simulates the scenario where the wallet supports all requested chains and subset of methods
  it("should establish authenticated session with multiple signatures. Case 4", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const supportedChains = requestedChains;
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const supportedMethods = [requestedMethods[0]];
    const { uri, response } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: supportedChains,
            methods: supportedMethods,
          });

          const auths: AuthTypes.Cacao[] = [];
          authPayload.chains.forEach(async (chain) => {
            const iss = `${chain}:${cryptoWallet.address}`;
            const message = wallet.engine.formatAuthMessage({
              request: authPayload,
              iss,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              authPayload,
              {
                t: "eip191",
                s: sig,
              },
              iss,
            );
            auths.push(auth);
          });

          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { session, auths } = await response();
    const walletSession = wallet.session.get(session.topic);
    expect(auths?.length).to.eq(supportedChains.length);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        await dapp.request({
          chainId: supportedChains[1],
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });
  it("should establish authenticated session", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.authenticate({
      chains: ["eip155:1", "eip155:2"],
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: ["personal_sign"],
      resources: [],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const auths: any[] = [];
          payload.params.authPayload.chains.forEach(async (chain) => {
            const message = wallet.engine.formatAuthMessage({
              request: payload.params.authPayload,
              iss: `${chain}:${cryptoWallet.address}`,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              payload.params.authPayload,
              {
                t: "eip191",
                s: sig,
              },
              `${chain}:${cryptoWallet.address}`,
            );
            auths.push(auth);
          });
          const result = await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          expect(result.session).to.exist;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { session, auths } = await response();
    const walletSession = wallet.session.get(session.topic);
    // approved namespaces on both sides must be equal
    expect(JSON.stringify(session.namespaces)).to.eq(JSON.stringify(walletSession.namespaces));
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });

  it("should establish normal sign session when URI doesn't specify `wc_sessionAuthenticate` method", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.authenticate({
      chains: ["eip155:1", "eip155:2"],
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: ["personal_sign", "eth_signTypedData_v4"],
    });

    expect(uri).to.exist;
    expect(uri).to.include("wc_sessionAuthenticate");

    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (payload) => {
          const approved = buildApprovedNamespaces({
            supportedNamespaces: {
              eip155: {
                methods: ["personal_sign", "eth_signTransaction", "eth_signTypedData_v4"],
                chains: ["eip155:1", "eip155:2", "eip155:3"],
                accounts: [
                  "eip155:1:" + cryptoWallet.address,
                  "eip155:2:" + cryptoWallet.address,
                  "eip155:3:" + cryptoWallet.address,
                ],
                events: [],
              },
            },
            proposal: payload.params,
          });
          await wallet.approve({
            id: payload.id,
            namespaces: approved,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri: uri.replace("methods", "") });
        resolve();
      }),
    ]);

    const res = await response();
    const session = res.session;
    await throttle(1000);

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });

  it("should establish normal sign session when wallet hasn't subscribed to session_authenticate", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.authenticate({
      chains: ["eip155:1", "eip155:2"],
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: ["personal_sign", "eth_signTypedData_v4"],
    });

    expect(uri).to.exist;
    expect(uri).to.include("wc_sessionAuthenticate");

    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (payload) => {
          const approved = buildApprovedNamespaces({
            supportedNamespaces: {
              eip155: {
                methods: ["personal_sign", "eth_signTransaction", "eth_signTypedData_v4"],
                chains: ["eip155:1", "eip155:2", "eip155:3"],
                accounts: [
                  "eip155:1:" + cryptoWallet.address,
                  "eip155:2:" + cryptoWallet.address,
                  "eip155:3:" + cryptoWallet.address,
                ],
                events: [],
              },
            },
            proposal: payload.params,
          });
          await wallet.approve({
            id: payload.id,
            namespaces: approved,
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);

    const res = await response();
    const session = res.session;
    await throttle(1000);

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);

    await deleteClients({ A: dapp, B: wallet });
  });

  it("should perform siwe", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.authenticate({
      chains: ["eip155:1"],
      domain: "localhost",
      nonce: "1",
      uri: "aud",
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });

    const result = await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          const auths: any[] = [];
          payload.params.authPayload.chains.forEach(async (chain) => {
            const message = wallet.engine.formatAuthMessage({
              request: payload.params.authPayload,
              iss: `${chain}:${cryptoWallet.address}`,
            });
            const sig = await cryptoWallet.signMessage(message);
            const auth = buildAuthObject(
              payload.params.authPayload,
              {
                t: "eip191",
                s: sig,
              },
              `${chain}:${cryptoWallet.address}`,
            );
            auths.push(auth);
          });
          const result = await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          // we expect `session` to be undefined as this is a siwe request
          expect(result.session).to.not.exist;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
      response(),
    ]).then((res) => res[2]);
    expect(result).to.exist;
    // its siwe request so session should be undefined
    expect(result.session).to.be.undefined;
    expect(result.auths).to.exist;
    expect(result.auths).to.have.length(1);
    await throttle(1000);
    await deleteClients({ A: dapp, B: wallet });
  });
  it("should perform siwe on fallback session via personal_sign", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.authenticate({
      chains: ["eip155:1"],
      domain: "localhost",
      nonce: "1",
      uri: "aud",
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });

    // force wallet to not support `wc_sessionAuthenticate` by removing it from registered methods
    const supportedMethods = ENGINE_RPC_OPTS;
    const toRegisterMethods = Object.keys(supportedMethods).filter(
      (method) => method !== "wc_sessionAuthenticate",
    );
    //@ts-expect-error
    wallet.core.pairing.registeredMethods = [];
    wallet.core.pairing.register({ methods: toRegisterMethods });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (payload) => {
          // validate that the dapp has both `session_authenticate` & `session_proposal` stored
          // and expirer configured
          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          expect(dapp.core.expirer.keys).to.include(`id:${pendingProposals[0].id}`);
          expect(dapp.core.expirer.get(pendingProposals[0].id)).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.exist;
          expect(dapp.core.expirer.get(pendingProposals[0].id)?.expiry).to.be.greaterThan(0);
          expect(pendingProposals[0].id).to.eq(payload.id);

          try {
            const approved = buildApprovedNamespaces({
              supportedNamespaces: {
                eip155: {
                  methods: ["personal_sign", "eth_signTransaction", "eth_signTypedData_v4"],
                  chains: ["eip155:1"],
                  accounts: ["eip155:1:" + cryptoWallet.address],
                  events: ["chainChanged", "accountsChanged"],
                },
              },
              proposal: payload.params,
            });
            await wallet.approve({
              id: payload.id,
              namespaces: approved,
            });
            resolve();
          } catch (e) {
            console.error("failed to approve session proposal");
            console.log(e);
          }
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    const { auths, session } = await response();
    expect(auths).to.be.undefined;
    expect(session).to.exist;
    expect(session.namespaces.eip155).to.exist;
    expect(session.namespaces.eip155.methods).to.exist;
    expect(session.namespaces.eip155.methods).to.have.length(1);
    expect(session.namespaces.eip155.methods[0]).to.eq("personal_sign");
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          chainId: "eip155:1",
          topic: session.topic,
          request: {
            method: "personal_sign",
            params: ["hey, sup"],
          },
        });
        resolve();
      }),
    ]);
    // confirm that all pending proposals and auth requests have been cleared
    expect(wallet.proposal.getAll().length).to.eq(0);
    expect(dapp.proposal.getAll().length).to.eq(0);
    expect(dapp.auth.requests.getAll().length).to.eq(0);
    await deleteClients({ A: dapp, B: wallet });
  });
  it("should use rejected tag for session_authenticate", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    const requestedChains = ["eip155:1", "eip155:2"];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const { uri } = await dapp.authenticate({
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "aud",
      methods: requestedMethods,
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });

    if (!uri) throw new Error("URI is undefined");
    expect(uri).to.exist;
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.core.relayer.once(RELAYER_EVENTS.publish, (payload) => {
          const { opts } = payload;
          const expectedOpts = ENGINE_RPC_OPTS.wc_sessionAuthenticate.reject;
          expect(opts).to.exist;
          expect(opts.tag).to.eq(expectedOpts?.tag);
          expect(opts.ttl).to.eq(expectedOpts?.ttl);
          expect(opts.prompt).to.eq(expectedOpts?.prompt);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.once("session_authenticate", async (params) => {
          await wallet.rejectSessionAuthenticate({
            id: params.id,
            reason: getSdkError("USER_REJECTED"),
          });
          resolve();
        });
      }),
      wallet.pair({ uri }),
    ]);
    await deleteClients({ A: dapp, B: wallet });
  });
});
