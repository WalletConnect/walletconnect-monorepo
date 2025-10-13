import { SignClientTypes } from "@walletconnect/types";
import { EthereumProvider } from "./EthereumProvider.js";

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
    native: string;
    universal?: string;
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
    "--wcm-z-index"?: string;
    "--wcm-accent-color"?: string;
    "--wcm-accent-fill-color"?: string;
    "--wcm-background-color"?: string;
    "--wcm-background-border-radius"?: string;
    "--wcm-container-border-radius"?: string;
    "--wcm-wallet-icon-border-radius"?: string;
    "--wcm-wallet-icon-large-border-radius"?: string;
    "--wcm-wallet-icon-small-border-radius"?: string;
    "--wcm-input-border-radius"?: string;
    "--wcm-notification-border-radius"?: string;
    "--wcm-button-border-radius"?: string;
    "--wcm-secondary-button-border-radius"?: string;
    "--wcm-icon-button-border-radius"?: string;
    "--wcm-button-hover-highlight-border-radius"?: string;
    "--wcm-font-family"?: string;
    "--wcm-font-feature-settings"?: string;
    "--wcm-text-big-bold-size"?: string;
    "--wcm-text-big-bold-weight"?: string;
    "--wcm-text-big-bold-line-height"?: string;
    "--wcm-text-big-bold-letter-spacing"?: string;
    "--wcm-text-big-bold-text-transform"?: string;
    "--wcm-text-big-bold-font-family"?: string;
    "--wcm-text-medium-regular-size"?: string;
    "--wcm-text-medium-regular-weight"?: string;
    "--wcm-text-medium-regular-line-height"?: string;
    "--wcm-text-medium-regular-letter-spacing"?: string;
    "--wcm-text-medium-regular-text-transform"?: string;
    "--wcm-text-medium-regular-font-family"?: string;
    "--wcm-text-small-regular-size"?: string;
    "--wcm-text-small-regular-weight"?: string;
    "--wcm-text-small-regular-line-height"?: string;
    "--wcm-text-small-regular-letter-spacing"?: string;
    "--wcm-text-small-regular-text-transform"?: string;
    "--wcm-text-small-regular-font-family"?: string;
    "--wcm-text-small-thin-size"?: string;
    "--wcm-text-small-thin-weight"?: string;
    "--wcm-text-small-thin-line-height"?: string;
    "--wcm-text-small-thin-letter-spacing"?: string;
    "--wcm-text-small-thin-text-transform"?: string;
    "--wcm-text-small-thin-font-family"?: string;
    "--wcm-text-xsmall-bold-size"?: string;
    "--wcm-text-xsmall-bold-weight"?: string;
    "--wcm-text-xsmall-bold-line-height"?: string;
    "--wcm-text-xsmall-bold-letter-spacing"?: string;
    "--wcm-text-xsmall-bold-text-transform"?: string;
    "--wcm-text-xsmall-bold-font-family"?: string;
    "--wcm-text-xsmall-regular-size"?: string;
    "--wcm-text-xsmall-regular-weight"?: string;
    "--wcm-text-xsmall-regular-line-height"?: string;
    "--wcm-text-xsmall-regular-letter-spacing"?: string;
    "--wcm-text-xsmall-regular-text-transform"?: string;
    "--wcm-text-xsmall-regular-font-family"?: string;
    "--wcm-overlay-background-color"?: string;
    "--wcm-overlay-backdrop-filter"?: string;
  };
  themeMode?: "dark" | "light";
}

export type WalletConnectModalConfig = ConfigCtrlState &
  ThemeCtrlState & {
    projectId: string;
    chains?: string[];
    mobileWallets?: MobileWallet[];
    desktopWallets?: DesktopWallet[];
    walletImages?: Record<string, string>;
    enableAuthMode?: boolean;
    enableExplorer?: boolean;
    enableMobileFullScreen?: boolean;
    explorerRecommendedWalletIds?: string[] | "NONE";
    explorerExcludedWalletIds?: string[] | "ALL";
    termsOfServiceUrl?: string;
    privacyPolicyUrl?: string;
  };

export type QrModalOptions = Pick<
  WalletConnectModalConfig,
  | "themeMode"
  | "themeVariables"
  | "desktopWallets"
  | "enableExplorer"
  | "enableMobileFullScreen"
  | "explorerRecommendedWalletIds"
  | "explorerExcludedWalletIds"
  | "mobileWallets"
  | "privacyPolicyUrl"
  | "termsOfServiceUrl"
  | "walletImages"
>;

// Viem compatible types
export type Assign<T, U> = Assign_<T, U> & U;
type Assign_<T, U> = {
  [K in keyof T as K extends keyof U ? (U[K] extends void ? never : K) : K]: K extends keyof U
    ? U[K]
    : T[K];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ChainFormatters = {
  block?: ChainFormatter<"block"> | undefined;
  transaction?: ChainFormatter<"transaction"> | undefined;
  transactionReceipt?: ChainFormatter<"transactionReceipt"> | undefined;
  transactionRequest?: ChainFormatter<"transactionRequest"> | undefined;
};

export type ChainFormatter<type extends string = string> = {
  format: (args: any) => any;
  type: type;
};
