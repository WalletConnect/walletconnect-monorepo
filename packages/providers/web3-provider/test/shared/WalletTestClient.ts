import { ethers } from "ethers";
import WalletConnect from "@walletconnect/client";
import { IConnector } from "@walletconnect/types";

import WalletConnectWeb3Provider from "../../src";
export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcURL: string;
}

export class WalletTestClient {
  readonly provider: WalletConnectWeb3Provider;
  readonly signer: ethers.Wallet;
  readonly chainId: number;
  // readonly wallet: ethers.Wallet;
  client?: IConnector;

  constructor(provider: WalletConnectWeb3Provider, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    const wallet = opts.privateKey
      ? new ethers.Wallet(opts.privateKey)
      : ethers.Wallet.createRandom();
    this.chainId = opts.chainId ? opts.chainId : 123;
    const rpcURL = opts.rpcURL ? opts.rpcURL : "http://localhost:8545";
    this.signer = wallet.connect(new ethers.providers.JsonRpcProvider(rpcURL));
  }

  approveSessionAndRequest() {
    return new Promise<void>(async (resolve, reject) => {
      await this.approveSession();
      if (!this.client) throw Error("Client(session) needs to be initiated first");
      this.client.on("call_request", async (error, payload) => {
        if (!this.client) throw Error("Client(session) needs to be initiated first");
        if (error) {
          reject(error);
        }

        if (payload.method === "eth_sendTransaction") {
          try {
            let transactionObject: ethers.providers.TransactionRequest = {
              from: payload.params[0].from,
              data: payload.params[0].data,
              chainId: this.chainId,
            };
            if (payload.params[0].gas) {
              transactionObject = {
                ...transactionObject,
                gasLimit: payload.params[0].gas,
              };
            }
            if (payload.params[0].to) {
              transactionObject = {
                ...transactionObject,
                to: payload.params[0].to,
              };
            }
            const tx = await this.signer.sendTransaction(transactionObject);
            await tx.wait();
            this.client.approveRequest({
              id: payload.id,
              result: tx.hash,
            });
            resolve();
          } catch (error) {
            await this.client.rejectRequest({
              id: payload.id,
              error: {
                message: "message" in error ? error.message : JSON.stringify(error),
              },
            });
          }
        }
        if (payload.method === "eth_sign") {
          try {
            const sign = await this.signer.signMessage(payload.params[1]);
            // console.log("signing at client");
            // console.log();
            // console.log("msg at clien,", payload.params[1]);
            // console.log("sig at client", sign);
            this.client.approveRequest({
              id: payload.id,
              result: sign,
            });
            resolve();
          } catch (error) {
            throw error;
          }
        }
        if (payload.method === "eth_signTransaction") {
          try {
            const signedTx = await this.signer.signTransaction(payload.params[0]);
            // console.log("signing at client");
            // console.log();
            // console.log("msg at clien,", payload.params[1]);
            // console.log("sig at client", sign);
            this.client.approveRequest({
              id: payload.id,
              result: signedTx,
            });
            resolve();
          } catch (error) {
            throw error;
          }
        }
        if (payload.method === "eth_sendRawTransaction") {
          try {
            const receipt = await this.provider.send("eth_sendRawTransaction", payload.params[0]);
            // console.log("signing at client");
            // console.log();
            // console.log("msg at clien,", payload.params[1]);
            // console.log("sig at client", sign);
            this.client.approveRequest({
              id: payload.id,
              result: receipt.hash,
            });
            resolve();
          } catch (error) {
            throw error;
          }
        }
      });
    });
  }

  // listen() {
  //   return new Promise<void>(async (resolve, reject) => {
  //     if (!this.client) throw Error("Client(session) needs to be initiated first");
  //     this.client.on("session_request", error => {
  //       if (!this.client) throw Error("Client(session) needs to be initiated first");
  //       if (error) {
  //         reject(error);
  //       }
  //       this.client.approveSession({
  //         accounts: [this.signer.address],
  //         chainId: this.chainId,
  //       });
  //     });

  //     this.client.on("disconnect", async error => {
  //       if (error) {
  //         reject(error);
  //       }
  //       resolve();
  //     });
  //   });
  // }

  approveSession() {
    return new Promise<void>((resolve, reject) => {
      this.provider.wc.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        this.client = new WalletConnect({ uri });
        this.client.on("session_request", error => {
          if (!this.client) throw Error("Client(session) needs to be initiated first");
          if (error) {
            reject(error);
          }
          this.client.approveSession({
            accounts: [this.signer.address],
            chainId: this.chainId,
          });
          resolve();
        });
      });
    });
  }
}
