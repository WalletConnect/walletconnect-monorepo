import WalletConnect from "@walletconnect/client";
import { IWalletConnectOptions } from "@walletconnect/types";
import { ReactNativeStorageOptions } from "keyvaluestorage";

export enum ConnectorEvents {
  CONNECT = "connect",
  CALL_REQUEST_SENT = "call_request_sent",
  SESSION_UPDATE = "session_update",
  DISCONNECT = "disconnect",
}

export type WalletService = {
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

export type ConnectToWalletServiceCallback = (walletService: WalletService, uri?: string) => Promise<void>;

export type WalletConnectContextValue = WalletConnectOptions & {
  readonly connectToWalletService: ConnectToWalletServiceCallback;
  readonly connector?: WalletConnect;
  readonly walletServices: readonly WalletService[];
};

// eslint-disable-next-line functional/no-mixed-type
export type RenderQrcodeModalProps = {
  readonly connectToWalletService: ConnectToWalletServiceCallback;
  readonly visible: boolean;
  readonly walletServices: readonly WalletService[];
  readonly uri?: string;
  readonly onDismiss: () => unknown;
};

export type RenderQrcodeModalCallback = (props: RenderQrcodeModalProps) => JSX.Element;

export type WalletConnectProviderProps = WalletConnectOptions & {
  readonly children: JSX.Element | readonly JSX.Element[];
  readonly renderQrcodeModal: RenderQrcodeModalCallback;
};
