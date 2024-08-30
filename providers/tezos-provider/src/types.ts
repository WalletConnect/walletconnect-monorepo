// response types are defined in
// https://docs.walletconnect.com/advanced/multichain/rpc-reference/tezos-rpc
export interface TezosGetAccountsData {
  algo: string;
  address: string;
  pubkey: string;
}
export type TezosGetAccountResponse = TezosGetAccountsData[];
export interface TezosSignResponse {
  signature: string;
}
export interface TezosSendResponse {
  hash: string;
}

export interface ChainData {
  name: string;
  id: string;
  rpc: string[];
  testnet: boolean;
  api?: string;
}

export interface ChainsMap {
  [reference: string]: ChainData;
}

export enum TezosMethod {
  GET_ACCOUNTS = "tezos_getAccounts",
  SEND = "tezos_send",
  SIGN = "tezos_sign"
}

export enum TezosEvent { 
  CHAIN_CHANGED = "chain_changed",
  ACCOUNTS_CHANGED = "accountsChanged",
  REQUEST_ACKNOWLEDGED = "requestAcknowledged"
}

export interface TezosConnectOpts {
  chains?: ChainData[]; // default: TezosChainData. Will connect to the first in the list
  methods?: TezosMethod[]; // default: defaultTezosMethods
  events?: TezosEvent[];
  optionalEvents?: string[];
}

export interface AssetData {
  symbol: string;
  name: string;
  balance: number;
}


export class TezosProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TezosProviderError";
  }
}

export class TezosConnectionError extends TezosProviderError {
  constructor() {
    super("Provider not connected. Click 'Connect' button.");
    this.name = "TezosConnectionError";
  }
}

export class TezosInitializationError extends TezosProviderError {
  constructor() {
    super("Provider not initialized. Reload page.");
    this.name = "TezosInitializationError";
  }
}