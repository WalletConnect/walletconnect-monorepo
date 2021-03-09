import WalletConnect from "@walletconnect/client";
import Web3 from "web3";

import WalletConnectWeb3Provider from "../src";

const TEST_SESSION_PARAMS = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"],
  chainId: 1,
};

describe("WalletConnectWeb3Provider", function () {
  it("instantiate successfully", () => {
    const provider = new WalletConnectWeb3Provider({
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    expect(!!provider).toBeTruthy();
  });

  it("enable successfully", async () => {
    const provider = new WalletConnectWeb3Provider({
      qrcode: false,
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        provider.wc.on("display_uri", (error, payload) => {
          if (error) {
            reject(error);
          }

          const uri = payload.params[0];

          const client = new WalletConnect({ uri });

          client.on("session_request", (error) => {
            if (error) {
              reject(error);
            }

            client.approveSession(TEST_SESSION_PARAMS);

            resolve();
          });
        });
      }),
      new Promise<void>(async (resolve) => {
        const providerAccounts = await provider.enable();
        expect(providerAccounts).toEqual(TEST_SESSION_PARAMS.accounts);

        const web3 = new Web3(provider as any);

        const web3Accounts = await web3.eth.getAccounts();
        expect(web3Accounts).toEqual(TEST_SESSION_PARAMS.accounts);

        const web3ChainId = await web3.eth.getChainId();
        expect(web3ChainId).toEqual(TEST_SESSION_PARAMS.chainId);

        resolve();
      }),
    ]);
  });
});
