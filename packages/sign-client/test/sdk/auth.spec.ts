/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { ENGINE_RPC_OPTS, SignClient } from "../../src";
import { TEST_APP_METADATA_B, TEST_SIGN_CLIENT_OPTIONS, throttle } from "../shared";
import {
  buildApprovedNamespaces,
  buildAuthObject,
  calcExpiry,
  populateAuthPayload,
} from "@walletconnect/utils";
import { AuthTypes } from "@walletconnect/types";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

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
      response(),
    ]).then((res) => res[2]);
    expect(result).to.exist;
    // its siwe request so session should be undefined
    expect(result.session).to.be.undefined;
    expect(result.auths).to.exist;
    expect(result.auths).to.have.length(1);
    await throttle(1000);
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

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (payload) => {
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
        wallet.pair({ uri: uri.replace("methods", "") });
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
  });
});
