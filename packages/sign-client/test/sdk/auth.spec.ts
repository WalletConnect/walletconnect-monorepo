/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { SignClient } from "../../src";
import { TEST_APP_METADATA_B, TEST_SIGN_CLIENT_OPTIONS, deleteClients, throttle } from "../shared";
import { buildAuthObject, formatRecapFromNamespaces, hashMessage } from "@walletconnect/utils";
import { AuthTypes } from "@walletconnect/types";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

describe("Authenticated Sessions", () => {
  let cryptoWallet: CryptoWallet;
  let iss: string;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
    iss = `did:pkh:eip155:1:${cryptoWallet.address}`;
  });

  it.only("init", async () => {
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
              iss: `did:pkh:${chain}:${cryptoWallet.address}`,
            });

            const sig = await cryptoWallet.signMessage(message);
            console.log("chain", chain, message, sig);
            const auth = buildAuthObject(
              payload.params.authPayload,
              {
                t: "eip191",
                s: sig,
              },
              `did:pkh:${chain}:${cryptoWallet.address}`,
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

    const res = await response;
    console.log("response", res);
    const sessions = dapp.session.getAll();
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
          topic: sessions[0].topic,
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

  // it.only("namespaces to recaps", async () => {
  //   const namespace = "eip155";
  //   const action = "request";
  //   const methods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData_v4"];

  //   const recap = formatRecapFromNamespaces(namespace, action, methods);
  //   expect(recap).to.be.exist;
  //   const expected = {
  //     att: {
  //       [namespace]: methods.map((method) => `${action}/${method}`),
  //     },
  //   };
  //   expect(recap).to.be.deep.eq(expected);
  //   console.log("recap", JSON.stringify(recap), expected);
  //   await throttle(1000);
  // });
});
