import WalletConnect from "@walletconnect/client";
import WalletConnectWeb3Provider from "../../src";
import { ethers } from "ethers";

export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
}

export class WalletTestClient {
  readonly provider: WalletConnectWeb3Provider;
  readonly wallet: ethers.Wallet;
  readonly chainId: number;
  client?: any;

  constructor(provider: WalletConnectWeb3Provider, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    this.wallet = opts.privateKey
      ? new ethers.Wallet(opts.privateKey)
      : ethers.Wallet.createRandom();
    this.chainId = opts.chainId ? opts.chainId : 123;
  }

  approveSession() {
    return new Promise<void>((resolve, reject) => {
      this.provider.wc.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        this.client = new WalletConnect({ uri });
        this.client.on("session_request", error => {
          if (error) {
            reject(error);
          }
          this.client.approveSession({
            accounts: [this.wallet.address],
            chainId: this.chainId,
          });
          resolve();
        });
      });
    });
  }
}
