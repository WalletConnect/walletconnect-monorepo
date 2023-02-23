import { SignClientTypes } from "@walletconnect/types";
import EventEmitter from "events";

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

export type ProviderChainId = ProviderInfo["chainId"];

export type ProviderAccounts = string[];

export interface EIP1102Request extends RequestArguments {
  method: "eth_requestAccounts";
}

export declare namespace IProviderEvents {
  type Event =
    | "connect"
    | "disconnect"
    | "message"
    | "chainChanged"
    | "accountsChanged"
    | "session_delete"
    | "session_event"
    | "session_update"
    | "display_uri";

  interface EventArguments {
    connect: ProviderInfo;
    disconnect: ProviderRpcError;
    message: ProviderMessage;
    chainChanged: ProviderChainId;
    accountsChanged: ProviderAccounts;
    session_delete: { topic: string };
    session_event: SignClientTypes.EventArguments["session_event"];
    session_update: SignClientTypes.EventArguments["session_delete"];
    display_uri: string;
  }
}
export interface IEthereumProviderEvents extends EventEmitter {
  on: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => any,
  ) => any;

  once: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => any,
  ) => any;

  off: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => any,
  ) => any;

  removeListener: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => any,
  ) => any;

  emit: <E extends IProviderEvents.Event>(
    event: E,
    payload: IProviderEvents.EventArguments[E],
  ) => any;
}

export interface EIP1193Provider {
  // connection event
  on(event: "connect", listener: (info: ProviderInfo) => void): this;
  // disconnection event
  on(event: "disconnect", listener: (error: ProviderRpcError) => void): this;
  // arbitrary messages
  on(event: "message", listener: (message: ProviderMessage) => void): this;
  // chain changed event
  on(event: "chainChanged", listener: (chainId: ProviderChainId) => void): this;
  // accounts changed event
  on(event: "accountsChanged", listener: (accounts: ProviderAccounts) => void): this;
  // make an Ethereum RPC method call.
  request(args: RequestArguments): Promise<unknown>;
}

export interface IEthereumProvider extends EIP1193Provider {
  // legacy alias for EIP-1102
  enable(): Promise<ProviderAccounts>;
}
