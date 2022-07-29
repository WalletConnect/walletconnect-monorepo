import SignClient from "@walletconnect/sign-client";
import { formatJsonRpcError, formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { SignClientTypes, SessionTypes } from "@walletconnect/types";
import { getSdkError, getChainsFromAccounts } from "@walletconnect/utils";
import { ethers, utils } from "ethers";
import EthereumProvider from "../../src";

export interface WalletClientOpts {
  privateKey: string;
  chainId: number;
  rpcUrl: string;
}

export type WalletClientAsyncOpts = WalletClientOpts & SignClientTypes.Options;

export class WalletClient {
  public provider: EthereumProvider;
  public signer: ethers.Wallet;
  public chainId: number;
  public rpcUrl: string;
  public client?: SignClient;
  public topic?: string;
  public namespaces?: SessionTypes.Namespaces;

  static async init(
    provider: EthereumProvider,
    opts: Partial<WalletClientAsyncOpts>,
  ): Promise<WalletClient> {
    const walletClient = new WalletClient(provider, opts);
    await walletClient.initialize(opts);
    return walletClient;
  }

  get accounts() {
    return [this.signer.address];
  }

  constructor(provider: EthereumProvider, opts: Partial<WalletClientOpts>) {
    this.provider = provider;
    this.chainId = opts?.chainId || 123;
    this.rpcUrl = opts?.rpcUrl || "http://localhost:8545";
    this.signer = this.getWallet(opts.privateKey);
  }

  public async changeAccount(privateKey: string) {
    this.setAccount(privateKey);
    await this.updateAccounts();
  }

  public async changeChain(chainId: number, rpcUrl: string) {
    this.setChainId(chainId, rpcUrl);
    await this.updateChainId();
  }

  public async disconnect() {
    if (!this.client) return;
    if (!this.topic) return;
    await this.client.disconnect({
      topic: this.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
  }

  private setAccount(privateKey: string) {
    if (!this.namespaces?.eip155) return;
    if (!this.namespaces.eip155.events.includes("accountsChanged")) {
      this.namespaces.eip155.events.push("accountsChanged");
    }

    this.signer = this.getWallet(privateKey);
    const { accounts } = this.namespaces.eip155;
    const caipAddress = `eip155:${this.chainId}:${this.signer.address}`;
    if (!accounts.includes(caipAddress)) this.namespaces.eip155.accounts.push(caipAddress);
  }

  private setChainId(chainId: number, rpcUrl: string) {
    if (!this.namespaces?.eip155) return;
    if (this.chainId !== chainId) {
      this.chainId = chainId;
      const chains = getChainsFromAccounts(this.namespaces.eip155.accounts);
      if (!chains.includes(`eip155:${chainId}`)) {
        this.namespaces.eip155.accounts.push(`eip155:${chainId}:${this.accounts[0]}`);
      }
      if (!this.namespaces.eip155.events.includes("chainChanged")) {
        this.namespaces.eip155.events.push("chainChanged");
      }
    }
    if (this.rpcUrl !== rpcUrl) {
      this.rpcUrl = rpcUrl;
      this.signer = this.signer.connect(new ethers.providers.JsonRpcProvider(this.rpcUrl));
    }
  }

  private async emitAccountsChangedEvent() {
    if (typeof this.client === "undefined") return;
    if (typeof this.topic === "undefined") return;
    const event = { name: "accountsChanged", data: [this.signer.address] };
    await this.client.emit({ topic: this.topic, event, chainId: `eip155:${this.chainId}` });
  }

  private async emitChainChangedEvent() {
    if (typeof this.client === "undefined") return;
    if (typeof this.topic === "undefined") return;
    const event = { name: "chainChanged", data: this.chainId };
    await this.client.emit({ topic: this.topic, event, chainId: `eip155:${this.chainId}` });
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

  private async updateSession() {
    if (typeof this.client === "undefined") return;
    if (typeof this.topic === "undefined") return;
    if (typeof this.namespaces === "undefined") return;
    await this.client.update({ topic: this.topic, namespaces: this.namespaces });
  }

  private async updateAccounts() {
    await this.updateSession();
    await this.emitAccountsChangedEvent();
  }

  private async updateChainId() {
    await this.updateSession();
    await this.emitChainChangedEvent();
  }

  private async initialize(opts?: SignClientTypes.Options) {
    this.client = await SignClient.init(opts);
    this.registerEventListeners();
  }

  private registerEventListeners() {
    if (typeof this.client === "undefined") {
      throw new Error("Sign Client not inititialized");
    }

    // auto-pair
    this.provider.signer.connection.on(SIGNER_EVENTS.uri, async ({ uri }: { uri: string }) => {
      if (typeof this.client === "undefined") throw new Error("Sign Client not inititialized");
      await this.client.pair({ uri });
    });

    // auto-approve
    this.client.on(
      "session_proposal",
      async (proposal: SignClientTypes.EventArguments["session_proposal"]) => {
        if (typeof this.client === "undefined") throw new Error("Sign Client not inititialized");
        const { id, requiredNamespaces, relays } = proposal.params;
        const namespaces = {};
        Object.entries(requiredNamespaces).forEach(([key, value]) => {
          namespaces[key] = {
            methods: value.methods,
            events: value.events,
            accounts: value.chains.map((chain) => `${chain}:${this.accounts[0]}`),
            extension: value.extension?.map((ext) => ({
              methods: ext.methods,
              events: ext.events,
              accounts: ext.chains.map((chain) => `${chain}:${this.accounts[0]}`),
            })),
          };
        });
        const { acknowledged } = await this.client.approve({
          id,
          relayProtocol: relays[0].protocol,
          namespaces,
        });
        const session = await acknowledged();
        this.topic = session.topic;
        this.namespaces = namespaces;
      },
    );

    // auto-respond
    this.client.on(
      "session_request",
      async (requestEvent: SignClientTypes.EventArguments["session_request"]) => {
        if (typeof this.client === "undefined") {
          throw new Error("Sign Client not inititialized");
        }
        const { topic, params, id } = requestEvent;
        const { chainId, request } = params;

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

          const response = formatJsonRpcResult(id, result);
          await this.client.respond({ topic, response });
        } catch (e: any) {
          const message = e.message || e.toString();
          const response = formatJsonRpcError(id, message);
          await this.client.respond({ topic, response });
        }
      },
    );
  }
}
