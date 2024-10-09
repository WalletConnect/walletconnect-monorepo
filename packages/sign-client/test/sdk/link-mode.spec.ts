import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { buildAuthObject, populateAuthPayload } from "@walletconnect/utils";
import { beforeAll, describe, expect, it } from "vitest";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";
import { SignClient } from "../../src";
import { throttle, TEST_SIGN_CLIENT_OPTIONS, TEST_APP_METADATA_B } from "../shared";

describe("Sign Client Link Mode", () => {
  let cryptoWallet: CryptoWallet;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
    const handlers: any = {};
    (global as any).Linking = {
      openURL: (url: any, sender: string) => {
        if (sender === "dapp") {
          handlers.wallet({ url }, "wallet");
        } else {
          handlers.dapp({ url }, "dapp");
        }
      },
      addEventListener: (_, cb, name) => {
        handlers[name] = cb;
      },
      getInitialURL: () => undefined,
    };
  });

  describe("ping", () => {
    it("should establish authenticated session with single signature via link mode", async () => {
      const dapp = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "dapp",
        metadata: {
          name: "dapp",
          description: "dapp description",
          url: "https://localhost:dapp",
          icons: ["https://localhost:3000/favicon.ico"],
          redirect: {
            universal: "https://localhost:/dapp",
            linkMode: true,
          },
        },
      });
      dapp.core.addLinkModeSupportedApp("https://localhost:/wallet");
      const requestedChains = ["eip155:1", "eip155:2"];
      const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
      const { uri, response } = await dapp.authenticate(
        {
          chains: requestedChains,
          domain: "localhost",
          nonce: "1",
          uri: "aud",
          methods: requestedMethods,
          resources: [
            "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
          ],
        },
        "https://localhost:/wallet",
      );
      const wallet = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS,
        name: "wallet",
        metadata: {
          ...TEST_APP_METADATA_B,
          redirect: {
            universal: "https://localhost:/wallet",
            linkMode: true,
          },
        },
      });

      expect(dapp.core.relayer.connected).to.be.false;
      expect(wallet.core.relayer.connected).to.be.false;

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
          global.Linking.openURL(uri, "dapp");
          resolve();
        }),
      ]);
      const { session } = await response();

      expect(dapp.core.relayer.connected).to.be.false;
      expect(wallet.core.relayer.connected).to.be.false;

      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.on("session_request", async (params) => {
            await wallet.respond({
              topic: session.topic,
              response: formatJsonRpcResult(params.id, "test"),
            });
            resolve();
          });
        }),
        new Promise<void>(async (resolve) => {
          const result = await dapp.request({
            topic: session.topic,
            request: {
              method: "personal_sign",
              params: ["0xdeadbeef", "0xAddress"],
            },
            chainId: "eip155:1",
          });
          resolve();
        }),
      ]);

      expect(dapp.core.relayer.connected).to.be.false;
      expect(wallet.core.relayer.connected).to.be.false;

      await throttle(2000);
    });
  });
});
