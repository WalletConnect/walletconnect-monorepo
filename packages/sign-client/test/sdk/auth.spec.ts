/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { SignClient } from "../../src";
import { TEST_APP_METADATA_B, TEST_SIGN_CLIENT_OPTIONS, deleteClients, throttle } from "../shared";
import {
  buildApprovedNamespaces,
  buildAuthObject,
  formatRecapFromNamespaces,
  hashMessage,
} from "@walletconnect/utils";
import { AuthTypes } from "@walletconnect/types";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

describe("Authenticated Sessions", () => {
  let cryptoWallet: CryptoWallet;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
  });

  it("init", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.sessionAuthenticate({
      chains: ["eip155:1", "eip155:2"],
      domain: "localhost",
      nonce: "1",
      aud: "aud",
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
        wallet.on("session_authenticate", async (payload) => {
          console.log("wallet session_authenticate", payload.params);

          const auths: AuthTypes.Cacao[] = [];
          payload.params.authPayload.chains.forEach(async (chain) => {
            console.log("cacaos", JSON.stringify(payload.params.authPayload));

            const message = wallet.engine.formatAuthMessage({
              request: payload.params.authPayload,
              iss: `${chain}:${cryptoWallet.address}`,
            });

            const sig = await cryptoWallet.signMessage(message);
            console.log("chain", chain, message, sig);
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
    const session = (await response).session;
    console.log("sessions");
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

  it("fallback", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const { uri, response } = await dapp.sessionAuthenticate({
      chains: ["eip155:1", "eip155:2"],
      domain: "localhost",
      nonce: "1",
      aud: "aud",
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
          console.log("wallet session_proposal", payload);
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
        wallet.pair({ uri: uri.replace("method", "") });
        resolve();
      }),
    ]);
    console.log("paired");

    const res = await response;
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
});
