import WalletConnect from "@walletconnect/client";
import { IWalletConnectOptions } from "@walletconnect/types";
import { ReactNativeStorageOptions } from "keyvaluestorage";

export enum ConnectorEvents {
  CONNECT = 'connect',
  CALL_REQUEST_SENT = 'call_request_sent',
  SESSION_UPDATE = 'session_update',
  DISCONNECT = 'disconnect',
}

export type WalletProvider = {
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly logo: string;
  readonly universalLink: string;
  readonly deepLink: string;
};

export type WalletConnectQrcodeModal = {
  readonly open: (uri: string, cb: unknown) => unknown;
  readonly close: () => unknown;
};

export type WalletConnectStorageOptions = ReactNativeStorageOptions & {
  readonly rootStorageKey?: string;
};

export type WalletConnectOptions = IWalletConnectOptions & {
  readonly redirectUrl: string;
  readonly storageOptions: Partial<WalletConnectStorageOptions>;
};

export type ConnectToProviderCallback = (provider: WalletProvider, uri?: string) => Promise<void>;

export type WalletConnectContextValue = WalletConnectOptions & {
  readonly connectToProvider: ConnectToProviderCallback;
  readonly connector?: WalletConnect;
  readonly providers: readonly WalletProvider[];
};

// eslint-disable-next-line functional/no-mixed-type
export type RenderQrcodeModalProps = {
  readonly connectToProvider: ConnectToProviderCallback;
  readonly visible: boolean;
  readonly providers: readonly WalletProvider[];
  readonly uri?: string;
  readonly onDismiss: () => unknown;
};

export type RenderQrcodeModalCallback = (props: RenderQrcodeModalProps) => JSX.Element;

export type WalletConnectProviderProps = WalletConnectOptions & {
  readonly children: JSX.Element | readonly JSX.Element[];
  readonly renderQrcodeModal: RenderQrcodeModalCallback;
};
