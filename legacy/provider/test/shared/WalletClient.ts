import { ethers, utils } from "ethers";
import WalletConnect from "@walletconnect/legacy-client";
import { IConnector } from "@walletconnect/legacy-types";

export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcUrl: string;
}

export class WalletClient {
  public provider: any;
  public signer: ethers.Wallet;
  public chainId: number;
  public rpcUrl: string;

  public client?: IConnector;

  constructor(provider: any, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    this.chainId = opts?.chainId || 123;
    this.rpcUrl = opts?.rpcUrl || "http://localhost:8545";
    this.signer = this.getWallet(opts.privateKey);
    this.initialize();
  }

  public async changeAccount(privateKey: string) {
    this.signer = this.getWallet(privateKey);
    await this.updateSession();
  }

  public async changeChain(chainId: number, rpcUrl: string) {
    this.setChain(chainId, rpcUrl);
    await this.updateSession();
  }

  public async disconnect() {
    if (!this.client) return;
    await this.client.killSession({ message: "User disconnected" });
  }

  private setChain(chainId: number, rpcUrl: string) {
    if (this.chainId !== chainId) {
      this.chainId = chainId;
    }
    if (this.rpcUrl !== rpcUrl) {
      this.rpcUrl = rpcUrl;
      this.signer = this.signer.connect(new ethers.providers.JsonRpcProvider(this.rpcUrl));
    }
  }

  private getWallet(privateKey?: string) {
    const wallet =
      typeof privateKey !== "undefined"
        ? new ethers.Wallet(privateKey)
        : ethers.Wallet.createRandom();
    return wallet.connect(new ethers.providers.JsonRpcProvider(this.rpcUrl));
  }

  private parseTxParams = (payload: any) => {
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

  private getSession() {
    return { accounts: [this.signer.address], chainId: this.chainId };
  }

  private async updateSession() {
    if (typeof this.client !== "undefined") {
      await this.client.updateSession(this.getSession());
    }
  }

  private initialize() {
    this.provider.connector.on("display_uri", (error: any, payload: any) => {
      if (error) {
        throw error;
      }
      // connect wallet client when provider displays URI
      this.client = new WalletConnect({ uri: payload.params[0] });

      // subscribe to session request and approve automatically
      this.client.on("session_request", (error: any, payload: any) => {
        if (!this.client) throw Error("Client(session) needs to be initiated first");
        if (error) {
          throw error;
        }
        if (payload.params[0].chainId !== this.chainId) {
          throw new Error("Invalid chainid for session request");
        }
        this.client.approveSession(this.getSession());
      });

      // subscribe to call request and resolve JSON-RPC payloads
      this.client.on("call_request", async (error: any, payload: any) => {
        if (!this.client) throw Error("Client(session) needs to be initiated first");

        if (error) {
          throw error;
        }

        try {
          let result: any;

          switch (payload.method) {
            case "eth_sendTransaction":
              //  eslint-disable-next-line no-case-declarations
              const tx = await this.signer.sendTransaction(this.parseTxParams(payload));
              await tx.wait();
              result = tx.hash;
              break;
            case "eth_signTransaction":
              //  eslint-disable-next-line no-case-declarations
              const txParams = await this.signer.populateTransaction(this.parseTxParams(payload));
              result = await this.signer.signTransaction(txParams);
              break;
            case "eth_sendRawTransaction":
              //  eslint-disable-next-line no-case-declarations
              const receipt = await this.signer.provider.sendTransaction(payload.params[0]);
              result = receipt.hash;
              break;
            case "eth_sign":
              //  eslint-disable-next-line no-case-declarations
              const ethMsg = payload.params[1];
              result = await this.signer.signMessage(utils.arrayify(ethMsg));
              break;
            case "personal_sign":
              //  eslint-disable-next-line no-case-declarations
              const personalMsg = payload.params[0];
              result = await this.signer.signMessage(utils.arrayify(personalMsg));
              break;
            default:
              throw new Error(`Method not supported: ${payload.method}`);
          }

          if (typeof result === "undefined") {
            throw new Error("Result was undefined");
          }

          this.client.approveRequest({ id: payload.id, result });
        } catch (e) {
          const message = e.message || e.toString();
          this.client.rejectRequest({ id: payload.id, error: { message } });
        }
      });
    });
  }
}
