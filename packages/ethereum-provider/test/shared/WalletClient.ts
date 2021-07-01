import { ethers, utils } from "ethers";
import Client, { CLIENT_EVENTS } from "@walletconnect/client";
import { AppMetadata, IClient, SessionTypes } from "@walletconnect/types";
import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { formatJsonRpcError, formatJsonRpcResult } from "@json-rpc-tools/utils";

import EthereumProvider from "../../src";

export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcUrl: string;
  relayProvider: string;
  metadata: AppMetadata;
}

export class WalletClient {
  public provider: EthereumProvider;
  public signer: ethers.Wallet;
  public chainId: number;
  public rpcUrl: string;
  public relayProvider?: string;
  public metadata?: AppMetadata;

  public client?: IClient;
  public topic?: string;

  static async init(
    provider: EthereumProvider,
    opts: Partial<WalletClientOpts>,
  ): Promise<WalletClient> {
    const walletClient = new WalletClient(provider, opts);
    await walletClient.initialize();
    return walletClient;
  }

  constructor(provider: EthereumProvider, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    this.chainId = opts?.chainId || 123;
    this.rpcUrl = opts?.rpcUrl || "http://localhost:8545";
    this.relayProvider = opts?.relayProvider || "ws://localhost:5555";
    this.metadata = opts?.metadata;
    this.signer = this.getWallet(opts.privateKey);
  }

  public async changeAccount(privateKey: string) {
    this.signer = this.getWallet(privateKey);
    await this.updateSession();
  }

  public async changeChain(chainId: number, rpcUrl: string) {
    this.setChain(chainId, rpcUrl);
    await this.updateSession();
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

  private getSessionState() {
    const account = `${this.signer.address}@eip155:${this.chainId}`;
    return { accounts: [account] };
  }

  private async updateSession() {
    if (typeof this.client === "undefined") return;
    if (typeof this.topic === "undefined") return;
    await this.client.update({ topic: this.topic, state: this.getSessionState() });
  }

  private async initialize() {
    const opts = {
      controller: true,
      relayProvider: this.relayProvider,
      metadata: this.metadata,
    };
    console.log("[initialize]", "opts", opts); // eslint-disable-line no-console
    this.client = await Client.init(opts);
    this.registerEventListeners();
  }

  private registerEventListeners() {
    console.log("[registerEventListeners]"); // eslint-disable-line no-console
    if (typeof this.client === "undefined") {
      throw new Error("Client not inititialized");
    }

    // auto-pair
    this.provider.signer.on(SIGNER_EVENTS.uri, async ({ uri }) => {
      console.log("[SIGNER_EVENTS.uri]", "uri", uri); // eslint-disable-line no-console
      console.log("[SIGNER_EVENTS.uri]", "!!this.client", !!this.client); // eslint-disable-line no-console

      if (typeof this.client === "undefined") {
        throw new Error("Client not inititialized");
      }
      await this.client.pair({ uri });
    });

    // auto-approve
    this.client.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
      console.log("[session.proposal]", "proposal", proposal); // eslint-disable-line no-console
      console.log("[session.proposal]", "!!this.client", !!this.client); // eslint-disable-line no-console

      if (typeof this.client === "undefined") {
        throw new Error("Client not inititialized");
      }
      const response = { state: this.getSessionState() };
      const session = await this.client.approve({ proposal, response });
      this.topic = session.topic;
    });

    // auto-respond
    this.client.on(
      CLIENT_EVENTS.session.request,
      async (requestEvent: SessionTypes.RequestEvent) => {
        console.log("[session.request]", "requestEvent", requestEvent); // eslint-disable-line no-console
        console.log("[session.request]", "!!this.client", !!this.client); // eslint-disable-line no-console

        if (typeof this.client === "undefined") {
          throw new Error("Client not inititialized");
        }
        const { topic, chainId, request } = requestEvent;

        // ignore if unmatched topic
        if (topic !== this.topic) return;

        try {
          // reject if no present target chainId
          if (typeof chainId === "undefined") {
            throw new Error("Missing target chainId");
          }
          const [_, chainRef] = chainId.split(":");
          // reject if unmatched chainId
          if (parseInt(chainRef, 10) !== this.chainId) {
            throw new Error(
              `Target chainId (${chainRef}) does not match active chainId (${this.chainId})`,
            );
          }

          let result: any;

          switch (request.method) {
            case "eth_sendTransaction":
              //  eslint-disable-next-line no-case-declarations
              const tx = await this.signer.sendTransaction(this.parseTxParams(request));
              await tx.wait();
              result = tx.hash;
              break;
            case "eth_signTransaction":
              //  eslint-disable-next-line no-case-declarations
              const txParams = await this.signer.populateTransaction(this.parseTxParams(request));
              result = await this.signer.signTransaction(txParams);
              break;
            case "eth_sendRawTransaction":
              //  eslint-disable-next-line no-case-declarations
              const receipt = await this.signer.provider.sendTransaction(request.params[0]);
              result = receipt.hash;
              break;
            case "eth_sign":
              //  eslint-disable-next-line no-case-declarations
              const ethMsg = request.params[1];
              result = await this.signer.signMessage(utils.arrayify(ethMsg));
              break;
            case "personal_sign":
              //  eslint-disable-next-line no-case-declarations
              const personalMsg = request.params[0];
              result = await this.signer.signMessage(utils.arrayify(personalMsg));
              break;
            default:
              throw new Error(`Method not supported: ${request.method}`);
          }

          // reject if undefined result
          if (typeof result === "undefined") {
            throw new Error("Result was undefined");
          }

          const response = formatJsonRpcResult(request.id, result);
          await this.client.respond({ topic, response });
        } catch (e) {
          const message = e.message || e.toString();
          const response = formatJsonRpcError(request.id, message);
          await this.client.respond({ topic, response });
        }
      },
    );
  }
}
