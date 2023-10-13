import { SignClientTypes } from "@walletconnect/types";
import { EthereumProvider } from "./EthereumProvider";

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
export interface IEthereumProviderEvents {
  on: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => void,
  ) => EthereumProvider;

  once: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => void,
  ) => EthereumProvider;

  off: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => void,
  ) => EthereumProvider;

  removeListener: <E extends IProviderEvents.Event>(
    event: E,
    listener: (args: IProviderEvents.EventArguments[E]) => void,
  ) => EthereumProvider;

  emit: <E extends IProviderEvents.Event>(
    event: E,
    payload: IProviderEvents.EventArguments[E],
  ) => boolean;
}

export interface EIP1193Provider {
  // connection event
  on(event: "connect", listener: (info: ProviderInfo) => void): EthereumProvider;
  // disconnection event
  on(event: "disconnect", listener: (error: ProviderRpcError) => void): EthereumProvider;
  // arbitrary messages
  on(event: "message", listener: (message: ProviderMessage) => void): EthereumProvider;
  // chain changed event
  on(event: "chainChanged", listener: (chainId: ProviderChainId) => void): EthereumProvider;
  // accounts changed event
  on(event: "accountsChanged", listener: (accounts: ProviderAccounts) => void): EthereumProvider;
  // make an Ethereum RPC method call.
  request(args: RequestArguments): Promise<unknown>;
}

export interface IEthereumProvider extends EIP1193Provider {
  // legacy alias for EIP-1102
  enable(): Promise<ProviderAccounts>;
}

export interface MobileWallet {
  id: string;
  name: string;
  links: {
    universal: string;
    native?: string;
  };
}
export interface DesktopWallet {
  id: string;
  name: string;
  links: {
    native: string;
    universal: string;
  };
}
export interface Chain {
  id: number;
  name: string;
}
export interface ConfigCtrlState {
  projectId: string;
  walletConnectVersion?: 1 | 2;
  standaloneChains?: string[];
  defaultChain?: Chain;
  mobileWallets?: MobileWallet[];
  desktopWallets?: DesktopWallet[];
  walletImages?: Record<string, string>;
  chainImages?: Record<string, string>;
  tokenImages?: Record<string, string>;
  tokenContracts?: Record<number, string>;
  enableAuthMode?: boolean;
  enableNetworkView?: boolean;
  enableAccountView?: boolean;
  enableExplorer?: boolean;
  explorerRecommendedWalletIds?: string[] | "NONE";
  explorerExcludedWalletIds?: string[] | "ALL";
  termsOfServiceUrl?: string;
  privacyPolicyUrl?: string;
}

export interface ThemeCtrlState {
  themeVariables?: {
    "--w3m-z-index"?: string;
    "--w3m-accent-color"?: string;
    "--w3m-accent-fill-color"?: string;
    "--w3m-background-color"?: string;
    "--w3m-background-image-url"?: string;
    "--w3m-logo-image-url"?: string;
    "--w3m-background-border-radius"?: string;
    "--w3m-container-border-radius"?: string;
    "--w3m-wallet-icon-border-radius"?: string;
    "--w3m-wallet-icon-large-border-radius"?: string;
    "--w3m-wallet-icon-small-border-radius"?: string;
    "--w3m-input-border-radius"?: string;
    "--w3m-notification-border-radius"?: string;
    "--w3m-button-border-radius"?: string;
    "--w3m-secondary-button-border-radius"?: string;
    "--w3m-icon-button-border-radius"?: string;
    "--w3m-button-hover-highlight-border-radius"?: string;
    "--w3m-font-family"?: string;
    "--w3m-text-big-bold-size"?: string;
    "--w3m-text-big-bold-weight"?: string;
    "--w3m-text-big-bold-line-height"?: string;
    "--w3m-text-big-bold-letter-spacing"?: string;
    "--w3m-text-big-bold-text-transform"?: string;
    "--w3m-text-big-bold-font-family"?: string;
    "--w3m-text-medium-regular-size"?: string;
    "--w3m-text-medium-regular-weight"?: string;
    "--w3m-text-medium-regular-line-height"?: string;
    "--w3m-text-medium-regular-letter-spacing"?: string;
    "--w3m-text-medium-regular-text-transform"?: string;
    "--w3m-text-medium-regular-font-family"?: string;
    "--w3m-text-small-regular-size"?: string;
    "--w3m-text-small-regular-weight"?: string;
    "--w3m-text-small-regular-line-height"?: string;
    "--w3m-text-small-regular-letter-spacing"?: string;
    "--w3m-text-small-regular-text-transform"?: string;
    "--w3m-text-small-regular-font-family"?: string;
    "--w3m-text-small-thin-size"?: string;
    "--w3m-text-small-thin-weight"?: string;
    "--w3m-text-small-thin-line-height"?: string;
    "--w3m-text-small-thin-letter-spacing"?: string;
    "--w3m-text-small-thin-text-transform"?: string;
    "--w3m-text-small-thin-font-family"?: string;
    "--w3m-text-xsmall-bold-size"?: string;
    "--w3m-text-xsmall-bold-weight"?: string;
    "--w3m-text-xsmall-bold-line-height"?: string;
    "--w3m-text-xsmall-bold-letter-spacing"?: string;
    "--w3m-text-xsmall-bold-text-transform"?: string;
    "--w3m-text-xsmall-bold-font-family"?: string;
    "--w3m-text-xsmall-regular-size"?: string;
    "--w3m-text-xsmall-regular-weight"?: string;
    "--w3m-text-xsmall-regular-line-height"?: string;
    "--w3m-text-xsmall-regular-letter-spacing"?: string;
    "--w3m-text-xsmall-regular-text-transform"?: string;
    "--w3m-text-xsmall-regular-font-family"?: string;
  };
  themeMode?: "dark" | "light";
}

export type WalletConnectModalConfig = ConfigCtrlState &
  ThemeCtrlState & { walletConnectVersion: 1 | 2 };

export type QrModalOptions = Pick<
  WalletConnectModalConfig,
  | "themeMode"
  | "themeVariables"
  | "desktopWallets"
  | "enableExplorer"
  | "explorerRecommendedWalletIds"
  | "explorerExcludedWalletIds"
  | "mobileWallets"
  | "privacyPolicyUrl"
  | "termsOfServiceUrl"
  | "walletImages"
>;
