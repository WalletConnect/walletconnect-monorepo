import { ethers } from "ethers";
import WalletConnect from "@walletconnect/client";
import { IConnector } from "@walletconnect/types";

export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcUrl: string;
}

export class WalletClient {
  public readonly provider: any;
  public readonly signer: ethers.Wallet;
  public readonly chainId: number;
  public readonly rpcUrl: string;

  public client?: IConnector;

  constructor(provider: any, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    const wallet = opts.privateKey
      ? new ethers.Wallet(opts.privateKey)
      : ethers.Wallet.createRandom();
    this.chainId = opts?.chainId || 123;
    this.rpcUrl = opts?.rpcUrl || "http://localhost:8545";
    this.signer = wallet.connect(new ethers.providers.JsonRpcProvider(this.rpcUrl));
    this.initialize();
  }

  private parseTxParams = payload => {
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

  private initialize() {
    this.provider.connector.on("display_uri", (error, payload) => {
      if (error) {
        throw error;
      }
      // connect wallet client when provider displays URI
      this.client = new WalletConnect({ uri: payload.params[0] });

      // subscribe to session request and approve automatically
      this.client.on("session_request", (error, payload) => {
        if (!this.client) throw Error("Client(session) needs to be initiated first");
        if (error) {
          throw error;
        }
        if (payload.params[0].chainId !== this.chainId) {
          throw new Error("Invalid chainid for session request");
        }
        const session = { accounts: [this.signer.address], chainId: this.chainId };
        this.client.approveSession(session);
      });

      // subscribe to call request and resolve JSON-RPC payloads
      this.client.on("call_request", async (error, payload) => {
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
              result = await this.signer.signTransaction(payload.params[0]);
              break;
            case "eth_sendRawTransaction":
              //  eslint-disable-next-line no-case-declarations
              const receipt = await this.signer.provider.sendTransaction(payload.params[0]);
              result = receipt.hash;
              break;
            case "eth_sign":
              result = await this.signer.signMessage(payload.params[1]);
              break;
            case "personal_sign":
              result = await this.signer.signMessage(payload.params[0]);
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
