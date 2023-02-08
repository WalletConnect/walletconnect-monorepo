export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

export interface ProviderMessage {
  type: string;
  data: unknown;
}

export interface ProviderInfo {
  chainId: string;
}

export interface RequestArguments {
  method: string;
  params?: unknown[] | object;
}

export type ProviderChainId = string;

export type ProviderAccounts = string[];

export interface EIP1102Request extends RequestArguments {
  method: "eth_requestAccounts";
}

export interface SimpleEventEmitter {
  // add listener
  on(event: string, listener: any): void;
  // add one-time listener
  once(event: string, listener: any): void;
  // remove listener
  removeListener(event: string, listener: any): void;
  // removeListener alias
  off(event: string, listener: any): void;
}

export interface EIP1193Provider extends SimpleEventEmitter {
  // connection event
  on(event: "connect", listener: (info: ProviderInfo) => void): void;
  // disconnection event
  on(event: "disconnect", listener: (error: ProviderRpcError) => void): void;
  // arbitrary messages
  on(event: "message", listener: (message: ProviderMessage) => void): void;
  // chain changed event
  on(event: "chainChanged", listener: (chainId: ProviderChainId) => void): void;
  // accounts changed event
  on(
    event: "accountsChanged",
    listener: (accounts: ProviderAccounts) => void
  ): void;
  // make an Ethereum RPC method call.
  request(args: RequestArguments): Promise<unknown>;
}

export interface IEthereumProvider extends EIP1193Provider {
  // legacy alias for EIP-1102
  enable(): Promise<ProviderAccounts>;
}