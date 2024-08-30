import { UniversalProvider, Metadata } from "@walletconnect/universal-provider";
import { KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";
import { Logger } from "@walletconnect/logger";
import { TezosToolkit } from "@taquito/taquito";
import { 
  PartialTezosDalPublishCommitmentOperation,
  PartialTezosDelegationOperation, 
  PartialTezosIncreasePaidStorageOperation, 
  PartialTezosOperation as PartialTezosOperationOriginal, 
  PartialTezosOriginationOperation as PartialTezosOriginationOperationOriginal,
  PartialTezosRegisterGlobalConstantOperation,
  PartialTezosRevealOperation,
  PartialTezosSetDepositsLimitOperation,
  PartialTezosSmartRollupAddMessagesOperation,
  PartialTezosSmartRollupCementOperation,
  PartialTezosSmartRollupExecuteOutboxMessageOperation,
  PartialTezosSmartRollupOriginateOperation,
  PartialTezosSmartRollupPublishOperation,
  PartialTezosSmartRollupRecoverBondOperation,
  PartialTezosSmartRollupRefuteOperation,
  PartialTezosSmartRollupTimeoutOperation,
  PartialTezosTransactionOperation, 
  PartialTezosTransferTicketOperation, 
  PartialTezosUpdateConsensusKeyOperation, 
  TezosActivateAccountOperation, 
  TezosBallotOperation, 
  TezosFailingNoopOperation, 
  TezosOperationType, 
  TezosProposalOperation,
} from "@airgap/beacon-types";

import { ScriptedContracts } from "@taquito/rpc";
import {
  AssetData,
  ChainsMap,
  TezosConnectionError,
  TezosConnectOpts,
  TezosGetAccountResponse,
  TezosInitializationError,
  TezosMethod,
  TezosProviderError,
  TezosSendResponse,
  TezosSignResponse
} from "./types";
import { DefaultTezosMethods, RelayUrl, TezosChainDataMainnet, TezosChainDataTestnet, TezosChainMap, UnsupportedOperations } from "./constants";

interface PartialTezosOriginationOperation extends Omit<PartialTezosOriginationOperationOriginal, "script"> {
  script: ScriptedContracts;
}

type PartialTezosOperation =
  | Exclude<PartialTezosOperationOriginal, PartialTezosOriginationOperationOriginal>
  | PartialTezosOriginationOperation;

export interface TezosProviderOpts {
  projectId: string;
  metadata: Metadata;
  relayUrl?: string;
  storageOptions?: KeyValueStorageOptions;
  disableProviderPing?: boolean;
  logger?: string | Logger; // default: "info"
}

// Provides a way to interact with the Tezos blockchain.
// Secures that WalletConnect is used with PartialTezosOperation
export class TezosProvider {
  public namespace: string = "tezos";
  public signer?: InstanceType<typeof UniversalProvider> = undefined;
  private tezosToolkit?: TezosToolkit;
  public address?: string;
  public isConnected: boolean = false;
  public config?: TezosProviderOpts;
  public chainId: string = "";
  public chainMap: ChainsMap = TezosChainMap;
  public accounts: string[] = [];

  constructor() {}

  static async init(opts: TezosProviderOpts = {
    projectId: "",
    metadata: {} as Metadata,
    relayUrl: RelayUrl, // default relay
    storageOptions: {} as KeyValueStorageOptions,
    disableProviderPing: false, // default is to enable ping
    logger: "info", // default log level
    }): Promise<TezosProvider> {
    const provider = new TezosProvider();
    await provider.initialize(opts);
    return provider;
  }

  protected async initialize(opts: TezosProviderOpts): Promise<void> {
    console.log("Initializing TezosProvider");

    this.config = {
      ...opts,
    };
    this.signer = await UniversalProvider.init({
      ...opts,
    });

    this.signer.on("connect", () => {
      this.isConnected = true;
    });
    this.signer.on("disconnect", () => {
      this.isConnected = false;
    });
  }

  static extractChainId(chain: string): string {
    return chain.includes(":") ? chain.split(":")[1] : chain;
  }

  static formatTezosBalance(asset: AssetData): string {
    const formattedBalance = (asset.balance / 1_000_000).toFixed(6);
    return `${asset.name}: ${formattedBalance} ${asset.symbol}`;
  }

  // Override connect method
  public async connect(opts: TezosConnectOpts = {
    chains: [TezosChainDataTestnet, TezosChainDataMainnet],
    methods: DefaultTezosMethods,
    events: [],
  }): Promise<any> {
    if (!this.signer || !this.config) {
      throw new TezosInitializationError();
    }
    if (!opts.chains || !opts.chains.length) {
      throw new TezosProviderError("No chains provided");
    }

    this.chainId = opts.chains[0].id;

    // convert chain data to map with chain id as a key
    this.chainMap = opts.chains.reduce((acc, chain) => {
      acc[chain.id] = chain;
      return acc;
    }, {} as ChainsMap);
    
    let res = await this.signer.connect({
      namespaces: {
        tezos: {
          chains: opts.chains.map((chain) => chain.id),
          methods: opts.methods ?? DefaultTezosMethods,
          events: opts.events ?? [],
        },
      },
    });
    this.isConnected = true;
    console.log("Connected to chain:", this.chainId);
  
    const rpcUrl = this.chainMap[this.chainId].rpc[0];
    this.tezosToolkit = new TezosToolkit(rpcUrl);
  
    // Set the address if the session exists
    if (this.signer.session) {
      let accounts = this.signer.session.namespaces.tezos?.accounts.map((account) => account.split(":")[2]) ?? [];
      if (!accounts.length) {
        throw new TezosProviderError("No accounts found in session");
      }
      // Ensure accounts array is unique
      this.accounts = [...new Set(accounts)];
      this.setAddress(this.accounts[0]);
    }
    return res;
  }

  public setAddress(address: string): void {
    if (!this.accounts.includes(address)) {
      throw new TezosProviderError(`Address ${address} not found in accounts ${this.accounts}. Get Accounts first.`);
    }
    this.address = address;
  }

  public getChainId(): string | undefined { 
    if (!this.config) {
      throw new TezosInitializationError();
    }
    return this.chainId;
  }

  // Method to get account balance
  public async getBalance(): Promise<AssetData> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    if (!this.tezosToolkit) {
      throw new TezosProviderError("tezosToolkit is not initialized");
    }
    const balance = await this.tezosToolkit.tz.getBalance(this.address);
    const balanceInTez = balance.toNumber();
    console.log(`Got balance: ${balanceInTez} ꜩ`);
    return {
      balance: balanceInTez,
      symbol: "ꜩ",
      name: "XTZ",
    };
  }

  public async getFormattedBalance(): Promise<string> {
    const balance = await this.getBalance();
    return `${balance.balance.toFixed(6)} ꜩ`; 
  }

  public async getContractAddress(
    hash: string
  ): Promise<string[]> {
    if (!hash) {
      throw new TezosProviderError(`No hash provided`);
    }
  
    const api = this.chainMap[this.chainId].api;
    const path = `${api}/operations/${hash}`;
    console.log(`Fetching contract address from: ${path}`);
  
    return fetch(path)
      .then((response) => response.json())
      .then((data) => {
        return data
          .map((op: any) => {
            const address = op?.status === 'applied' && op?.originatedContract?.kind === "smart_contract" ? op.originatedContract.address : '';
            if (address) {
              console.log('Got contract address:', address);
            }
            return address;
          })
          .filter((address: string) => address.length);
      });
  }

  public async getCurrentProposal(): Promise<string | null> {
    if (!this.tezosToolkit) {
      throw new TezosProviderError("tezosToolkit is not initialized");
    }
    const currentProposal = await this.tezosToolkit.rpc.getCurrentProposal();
    console.log(`Current proposal: ${currentProposal}`);
    return currentProposal;
  }

  public async checkConnection(): Promise<boolean> {
    if (!this.isConnected || !this.address) {
      throw new TezosConnectionError();
    }    
    return true;
  }
  
  // Requests using the WalletConnect connection
  
  public async tezosGetAccounts(): Promise<TezosGetAccountResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    await this.checkConnection();
  
    const result = await this.signer.request<TezosGetAccountResponse>({
      method: TezosMethod.GET_ACCOUNTS,
      params: {},
    }, this.chainId);
    this.accounts = result.map((account) => account.address);
  
    return result;
  }

  // Method to sign a message
  public async tezosSign(payload: string): Promise<TezosSignResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    await this.checkConnection();
    
    const result = await this.signer.request<TezosSignResponse>({
      method: TezosMethod.SIGN,
      params: {
        account: this.address,
        payload,
      },
    }, this.chainId);

    return result;
  }

  // Method to send operations
  public async tezosSend(op: PartialTezosOperation): Promise<TezosSendResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    if (!this.address) {
      throw new TezosConnectionError();
    }
    if (UnsupportedOperations.includes(op.kind)) {
      throw new TezosProviderError(`Operation ${op.kind} is not supported for wallets`);
    }

    await this.checkConnection();
    
    const result = await this.signer.request<TezosSendResponse>({
      method: TezosMethod.SEND,
      params: {
        account: this.address,
        operations: [op],
      },
    }, this.chainId);

    return result;
  }

  // Method to send a transaction
  public async tezosSendTransaction(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to send a delegation
  public async tezosSendDelegation(op: PartialTezosDelegationOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to send an undelegation
  public async tezosSendUndelegation(): Promise<TezosSendResponse> {
    const op: PartialTezosDelegationOperation = { kind: TezosOperationType.DELEGATION };
    return this.tezosSend(op);
  }

  // Method to originate a contract
  public async tezosSendOrigination(op: PartialTezosOriginationOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to call a smart contract: destination is the contract address, entrypoint as defined in the contract
  public async tezosSendContractCall(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendStake(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return this.tezosSend({
      ...op,
      destination: this.address,
      parameters: {entrypoint: "stake", value: { prim: "Unit" }},
    });
  }

  public async tezosSendUnstake(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return this.tezosSend({
      ...op,
      destination: this.address,
      parameters: {entrypoint: "unstake", value: { prim: "Unit" }},
    });
  }

  public async tezosSendFinalizeUnstake(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return this.tezosSend({
      ...op,
      destination: this.address,
      parameters: {entrypoint: "finalize_unstake", value: { prim: "Unit" }},
    });
  }

  public async tezosSendActivateAccount(op: TezosActivateAccountOperation): Promise<TezosSendResponse> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return this.tezosSend({...op, pkh: this.address});
  }

  public async tezosSendBallot(op: TezosBallotOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendDalPublishCommitment(op: PartialTezosDalPublishCommitmentOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendFailingNoop(op: TezosFailingNoopOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendIncreasePaidStorage(op: PartialTezosIncreasePaidStorageOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendProposal(op: TezosProposalOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendRegisterGlobalConstant(op: PartialTezosRegisterGlobalConstantOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendReveal(op: PartialTezosRevealOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSetDepositsLimit(op: PartialTezosSetDepositsLimitOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupAddMessages(op: PartialTezosSmartRollupAddMessagesOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupCement(op: PartialTezosSmartRollupCementOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupExecuteOutboxMessage(op: PartialTezosSmartRollupExecuteOutboxMessageOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupOriginate(op: PartialTezosSmartRollupOriginateOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupPublish(op: PartialTezosSmartRollupPublishOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupRecoverBond(op: PartialTezosSmartRollupRecoverBondOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupRefute(op: PartialTezosSmartRollupRefuteOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendSmartRollupTimeout(op: PartialTezosSmartRollupTimeoutOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendTransferTicket(op: PartialTezosTransferTicketOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  public async tezosSendUpdateConsensusKey(op: PartialTezosUpdateConsensusKeyOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }
}

export default TezosProvider;
