import { ICryptoLib } from "./crypto";
import { ITxData } from "./ethereum";
import {
  IJsonRpcRequest,
  IJsonRpcResponseError,
  IJsonRpcResponseSuccess,
  IRequestOptions,
} from "./jsonrpc";
import { IQRCodeModal, IQRCodeModalOptions } from "./qrcode";
import { ITransportLib } from "./socket";
import { ISessionStorage } from "./storage";

export interface IConnector {
  bridge: string;
  key: string;
  clientId: string;
  peerId: string;
  readonly clientMeta: IClientMeta | null;
  peerMeta: IClientMeta | null;
  handshakeTopic: string;
  handshakeId: number;
  uri: string;
  chainId: number;
  networkId: number;
  accounts: string[];
  rpcUrl: string;
  readonly connected: boolean;
  readonly pending: boolean;
  session: IWalletConnectSession;

  on(event: string, callback: (error: Error | null, payload: any | null) => void): void;
  connect(opts?: ICreateSessionOptions): Promise<ISessionStatus>;
  createSession(opts?: ICreateSessionOptions): Promise<void>;
  approveSession(sessionStatus: ISessionStatus): void;
  rejectSession(sessionError?: ISessionError): void;
  updateSession(sessionStatus: ISessionStatus): void;
  killSession(sessionError?: ISessionError): Promise<void>;

  sendTransaction(tx: ITxData): Promise<any>;
  signTransaction(tx: ITxData): Promise<any>;
  signMessage(params: any[]): Promise<any>;
  signPersonalMessage(params: any[]): Promise<any>;
  signTypedData(params: any[]): Promise<any>;
  updateChain(chainParams: IUpdateChainParams): Promise<any>;

  sendCustomRequest(request: Partial<IJsonRpcRequest>, options?: IRequestOptions): Promise<any>;
  unsafeSend(
    request: IJsonRpcRequest,
    options?: IRequestOptions,
  ): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError>;

  approveRequest(response: Partial<IJsonRpcResponseSuccess>): void;
  rejectRequest(response: Partial<IJsonRpcResponseError>): void;
}

export interface IRequiredParamsResult {
  handshakeTopic: string;
  version: number;
}

export interface IQueryParamsResult {
  bridge: string;
  key: string;
}

export interface IParseURIResult {
  protocol: string;
  handshakeTopic: string;
  version: number;
  bridge: string;
  key: string;
}

export interface IConnectorOpts {
  cryptoLib: ICryptoLib;
  connectorOpts: IWalletConnectOptions;
  transport?: ITransportLib;
  sessionStorage?: ISessionStorage;
  pushServerOpts?: IPushServerOptions;
}

export interface ICreateSessionOptions {
  chainId?: number;
}

export interface INodeJSOptions {
  clientMeta: IClientMeta;
}

export interface IPushServerOptions {
  url: string;
  type: string;
  token: string;
  peerMeta?: boolean;
  language?: string;
}

export interface INativeWalletOptions {
  clientMeta: IClientMeta;
  push?: IPushServerOptions | null;
}

export interface IPushSubscription {
  bridge: string;
  topic: string;
  type: string;
  token: string;
  peerName: string;
  language: string;
}

export interface IUpdateChainParams {
  chainId: number;
  networkId: number;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
  };
}

export interface IClientMeta {
  description: string;
  url: string;
  icons: string[];
  name: string;
}

export interface ISessionStatus {
  chainId: number;
  accounts: string[];
  networkId?: number;
  rpcUrl?: string;
}

export interface ISessionError {
  message?: string;
}

export interface ISessionParams {
  approved: boolean;
  chainId: number | null;
  networkId: number | null;
  accounts: string[] | null;
  rpcUrl?: string | null;
  peerId?: string | null;
  peerMeta?: IClientMeta | null;
}

export interface IWalletConnectSession {
  connected: boolean;
  accounts: string[];
  chainId: number;
  bridge: string;
  key: string;
  clientId: string;
  clientMeta: IClientMeta | null;
  peerId: string;
  peerMeta: IClientMeta | null;
  handshakeId: number;
  handshakeTopic: string;
}

export interface IWalletConnectOptions {
  bridge?: string;
  uri?: string;
  storageId?: string;
  signingMethods?: string[];
  session?: IWalletConnectSession;
  storage?: ISessionStorage;
  clientMeta?: IClientMeta;
  qrcodeModal?: IQRCodeModal;
  qrcodeModalOptions?: IQRCodeModalOptions;
}

export interface IWalletConnectSDKOptions extends IWalletConnectOptions {
  bridge?: string;
}
