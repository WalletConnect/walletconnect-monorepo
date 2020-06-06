import Web3 from "web3";
import WalletConnect from "@walletconnect/client";

import WalletConnectWeb3Provider from "../src";

const TEST_SESSION_PARAMS = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"],
  chainId: 1,
};

describe("WalletConnectWeb3Provider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectWeb3Provider({
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    expect(provider).toBeTruthy();
  });
  it("enable successfully", async () => {
    const provider = new WalletConnectWeb3Provider({
      qrcode: false,
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    console.log("provider created"); // eslint-disable-line

    await Promise.all([
      new Promise((resolve, reject) => {
        provider.wc.on("display_uri", (error, payload) => {
          console.log("display_uri", payload); // eslint-disable-line
          if (error) {
            reject(error);
          }
          const uri = payload.params[0];
          const client = new WalletConnect({ uri });
          client.on("session_request", (error, payload) => {
            console.log("session_request", payload); // eslint-disable-line
            if (error) {
              reject(error);
            }
            client.approveSession(TEST_SESSION_PARAMS);
            resolve();
          });
        });
      }),
      new Promise(async resolve => {
        console.log("provider trigger enable"); // eslint-disable-line
        const providerAccounts = await provider.enable();
        console.log("provider enable", providerAccounts); // eslint-disable-line
        expect(providerAccounts).toEqual(TEST_SESSION_PARAMS.accounts);
        const web3 = new Web3(provider as any);
        console.log("web3 instantiated"); // eslint-disable-line

        const web3Accounts = await web3.eth.getAccounts();

        console.log("web3Accounts", web3Accounts); // eslint-disable-line
        expect(web3Accounts).toEqual(TEST_SESSION_PARAMS.accounts);

        const web3ChainId = await web3.eth.getChainId();
        console.log("web3ChainId", web3ChainId); // eslint-disable-line
        expect(web3ChainId).toEqual(TEST_SESSION_PARAMS.chainId);

        resolve();
      }),
    ]);
  });
});
