import { ethers } from "ethers";
import WalletConnect from "@walletconnect/client";
import { IConnector } from "@walletconnect/types";

import WalletConnectWeb3Provider from "../../src";
export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcUrl: string;
}

export class WalletClient {
  readonly provider: WalletConnectWeb3Provider;
  readonly signer: ethers.Wallet;
  readonly chainId: number;
  readonly rpcUrl: string;

  client?: IConnector;

  constructor(provider: WalletConnectWeb3Provider, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    const wallet = opts.privateKey
      ? new ethers.Wallet(opts.privateKey)
      : ethers.Wallet.createRandom();
    this.chainId = opts?.chainId || 123;
    this.rpcUrl = opts?.rpcUrl || "http://localhost:8545";
    this.signer = wallet.connect(new ethers.providers.JsonRpcProvider(this.rpcUrl));
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

        try {
          const result = await this.resolveRequest(payload);
          this.client.approveRequest({ id: payload.id, result });
          resolve(result);
        } catch (e) {
          const errorMessage = e.message || e.toString();
          this.client.rejectRequest({ id: payload.id, error: { message: errorMessage } });
          reject(e);
        }
      });
    });
  }

  parseTxParams = payload => {
    let txParams: ethers.providers.TransactionRequest = {
      from: payload.params[0].from,
      data: payload.params[0].data,
      chainId: this.chainId,
    };
    if (payload.params[0].gas) {
      txParams = {
        ...txParams,
        gasLimit: payload.params[0].gas,
      };
    }
    if (payload.params[0].to) {
      txParams = {
        ...txParams,
        to: payload.params[0].to,
      };
    }
    return txParams;
  };

  resolveRequest = async payload => {
    let result: any;

    switch (payload.method) {
      case "eth_sendTransaction":
        //  eslint-disable-next-line no-case-declarations
        const tx = await this.signer.sendTransaction(this.parseTxParams(payload));
        await tx.wait();
        result = tx.hash;
        break;
      case "eth_signTransaction":
        result = await this.signer.signTransaction(payload.params[0]);
        break;
      case "eth_sendRawTransaction":
        //  eslint-disable-next-line no-case-declarations
        const receipt = await this.provider.sendTransaction(
          "eth_sendRawTransaction",
          payload.params[0],
        );
        result = receipt.hash;
        break;
      case "eth_sign":
        result = await this.signer.signMessage(payload.params[1]);
        break;
      case "personal_sign":
        result = await this.signer.signMessage(payload.params[0]);
        break;
      default:
        break;
    }
    return result;
  };

  approveSession() {
    return new Promise<string[]>(async (resolve, reject) => {
      this.provider.connector.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        this.client = new WalletConnect({ uri });
        this.client.on("session_request", (error, payload) => {
          if (!this.client) throw Error("Client(session) needs to be initiated first");
          if (error) {
            reject(error);
          }
          if (payload.params[0].chainId !== this.chainId) {
            return reject(new Error("Invalid chainid for session request"));
          }
          const session = { accounts: [this.signer.address], chainId: this.chainId };
          this.client.approveSession(session);
        });
      });
      const accounts = await this.provider.enable();
      resolve(accounts);
    });
  }
}
