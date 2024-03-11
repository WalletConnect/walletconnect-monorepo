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
      methods: ["personal_sign", "eth_chainId", "eth_signTypedData_v4"],
      resources: [
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    });
    console.log("uri", uri);
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          console.log("wallet session_authenticate", payload.params);

          // validate expiryTimestamp
          // expect(payload.params.expiryTimestamp).to.be.approximately(expectedExpiry, 2000);

          // console.log("authPayload", JSON.stringify(authPayload));
          const authPayload = populateAuthPayload({
            authPayload: payload.params.authPayload,
            chains: ["eip155:1", "eip155:2"],
            methods: ["personal_sign"],
          });

          // payload.params.authPayload.chains.forEach(async (chain) => {
          //   console.log("cacaos", JSON.stringify(payload.params.authPayload));
          const message = wallet.engine.formatAuthMessage({
            request: authPayload,
            iss: `eip155:1:${cryptoWallet.address}`,
          });

          console.log("message", message);
          const sig = await cryptoWallet.signMessage(message);
          console.log("signed message", {
            sig,
            privateKey: cryptoWallet.privateKey,
            address: cryptoWallet.address,
          });
          const auth = buildAuthObject(
            authPayload,
            {
              t: "eip191",
              s: sig,
            },
            `eip155:1:${cryptoWallet.address}`,
          );
          console.log("auth", auth);
          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths: [auth],
          });
          console.log("wallet session_authenticate approved");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    console.log("paired");

    console.log("response", response);
    const session = (await response()).session;
    console.log("sessions", session);
    // await throttle(1000);

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          console.log("wallet session_request", payload);
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          console.log("wallet session_request responded");
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
        console.log("dapp request result", result);
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
      resources: [
        // "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9leGFtcGxlLmNvbSI6W3sicHVzaC9ub3RpZmljYXRpb24iOlt7fV19XX19==",
      ],
    });
    const expectedExpiry = calcExpiry(ENGINE_RPC_OPTS.wc_sessionAuthenticate.req.ttl);
    console.log("uri", uri);
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          console.log("wallet session_authenticate", payload.params);

          // validate expiryTimestamp
          // expect(payload.params.expiryTimestamp).to.be.approximately(expectedExpiry, 2000);
          const auths: any[] = [];
          payload.params.authPayload.chains.forEach(async (chain) => {
            //   console.log("cacaos", JSON.stringify(payload.params.authPayload));
            const message = wallet.engine.formatAuthMessage({
              request: payload.params.authPayload,
              iss: `${chain}:${cryptoWallet.address}`,
            });

            console.log("message", message);
            const sig = await cryptoWallet.signMessage(message);
            console.log("signed message", {
              sig,
              privateKey: cryptoWallet.privateKey,
              address: cryptoWallet.address,
            });
            const auth = buildAuthObject(
              payload.params.authPayload,
              {
                t: "eip191",
                s: sig,
              },
              `${chain}:${cryptoWallet.address}`,
            );
            console.log("auth", auth);
            auths.push(auth);
          });

          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          console.log("wallet session_authenticate approved");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.pair({ uri });
        resolve();
      }),
    ]);
    console.log("paired");

    console.log("response", response);
    const session = (await response()).session;
    console.log("sessions", session);
    // await throttle(1000);

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          console.log("wallet session_request", payload);
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          console.log("wallet session_request responded");
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
        console.log("dapp request result", result);
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
    console.log("uri", uri);
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (payload) => {
          console.log("wallet session_proposal", payload.id);
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
          console.log("wallet session_proposal approved", approved);
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
    console.log("paired");

    const res = await response();
    const session = res.session;
    console.log("response", res);
    await throttle(1000);

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_request", async (payload) => {
          console.log("wallet session_request", payload);
          const { id, topic } = payload;
          await wallet.respond({
            topic,
            response: formatJsonRpcResult(
              id,
              await cryptoWallet.signMessage(payload.params.request.params[0]),
            ),
          });
          console.log("wallet session_request responded");
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
        console.log("dapp request result", result);
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
    console.log("uri", uri);
    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });

    const result = await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_authenticate", async (payload) => {
          console.log("wallet session_authenticate", payload.params);
          // validate expiryTimestamp
          // expect(payload.params.expiryTimestamp).to.be.approximately(expectedExpiry, 2000);
          const auths: any[] = [];
          payload.params.authPayload.chains.forEach(async (chain) => {
            //   console.log("cacaos", JSON.stringify(payload.params.authPayload));
            const message = wallet.engine.formatAuthMessage({
              request: payload.params.authPayload,
              iss: `${chain}:${cryptoWallet.address}`,
            });

            console.log("message", message);
            const sig = await cryptoWallet.signMessage(message);
            console.log("signed message", {
              sig,
              privateKey: cryptoWallet.privateKey,
              address: cryptoWallet.address,
            });
            const auth = buildAuthObject(
              payload.params.authPayload,
              {
                t: "eip191",
                s: sig,
              },
              `${chain}:${cryptoWallet.address}`,
            );
            console.log("auth", auth);
            auths.push(auth);
          });
          await wallet.approveSessionAuthenticate({
            id: payload.id,
            auths,
          });
          console.log("wallet session_authenticate approved");
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
});
