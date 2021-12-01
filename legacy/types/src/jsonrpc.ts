import { IClientMeta, IConnector } from "./protocol";
import { IEvents } from "./events";
import { IQRCodeModal, IQRCodeModalOptions } from "./qrcode";

export interface IRpcConnection extends IEvents {
  connected: boolean;

  send(payload: any): Promise<any>;
  open(): Promise<void>;
  close(): Promise<void>;
}

export interface IWCRpcConnection extends IRpcConnection {
  bridge: string;
  qrcode: boolean;
  qrcodeModalOptions: IQRCodeModalOptions | undefined;
  wc: IConnector;
  chainId: number;
  connected: boolean;
  connector: IConnector;

  create(chainId?: number): void;
  open(): Promise<void>;
  close(): Promise<void>;
  onOpen(): void;
  onClose(): void;
  onError(payload: any, message: string, code?: number): void;
  send(payload: any): Promise<any>;
  sendPayload(payload: any): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError>;
}

export interface IJsonRpcResponseSuccess {
  id: number;
  jsonrpc: string;
  result: any;
}

export interface IJsonRpcErrorMessage {
  code?: number;
  message: string;
}

export interface IJsonRpcResponseError {
  id: number;
  jsonrpc: string;
  error: IJsonRpcErrorMessage;
}

export interface IJsonRpcRequest {
  id: number;
  jsonrpc: string;
  method: string;
  params: any[];
}

export interface IJsonRpcSubscription {
  id: number;
  jsonrpc: string;
  method: string;
  params: any;
}

export type JsonRpc =
  | IJsonRpcRequest
  | IJsonRpcSubscription
  | IJsonRpcResponseSuccess
  | IJsonRpcResponseError;

export interface IRPCMap {
  [chainId: number]: string;
}

export interface IRpcConfig {
  infuraId: string | undefined;
  custom: IRPCMap | undefined;
}

export interface IWCRpcConnectionOptions {
  connector?: IConnector;
  bridge?: string;
  qrcode?: boolean;
  chainId?: number;
  storageId?: string;
  signingMethods?: string[];
  qrcodeModalOptions?: IQRCodeModalOptions;
  clientMeta?: IClientMeta;
}

export interface IWCEthRpcConnectionOptions extends IWCRpcConnectionOptions {
  rpc?: IRPCMap;
  infuraId?: string;
}

export interface IWalletConnectStarkwareProviderOptions extends IWCRpcConnectionOptions {
  contractAddress: string;
}

export interface IWalletConnectProviderOptions extends IWCEthRpcConnectionOptions {
  pollingInterval?: number;
  qrcodeModal?: IQRCodeModal;
}

export interface IRequestOptions {
  forcePushNotification?: boolean;
}

export interface IInternalRequestOptions extends IRequestOptions {
  topic: string;
}
