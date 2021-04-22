import { JsonRpcResponse, JsonRpcResult, JsonRpcError } from "@json-rpc-tools/utils";
export interface WakuPeers {
  multiaddr: string;
  protocol: string;
  connected: boolean;
}
export interface WakuInfo {
  listenStr: string;
}

export interface WakuMessage {
  payload: string;
  contentTopic: string;
  version: number;
  proof: Uint8Array;
  timestamp: number;
}

export interface WakuMessageResponse {
  payload: Uint8Array;
  contentTopic: string;
  version: number;
  proof: Uint8Array;
  timestamp: number;
}

export interface Index {
  digest: string;
  receivedTime: number;
}

export interface PagingOptions {
  pageSize: number;
  cursor?: Index;
  forward: boolean;
}

export interface StoreResponse {
  messages: WakuMessageResponse[];
  pagingOptions?: PagingOptions;
}

export interface IMessageCB {
  (error: JsonRpcError | undefined, m: WakuMessage[]): void;
}
export interface IPeersCB {
  (err: JsonRpcError | undefined, peers: WakuPeers[]): void;
}
export interface IJsonRpcCB {
  (result: JsonRpcError | undefined, okay: boolean): void;
}
export interface IInfoCB {
  (error: JsonRpcError | undefined, value: WakuInfo): void;
}
export declare namespace IWakuCB {
  export type Message = IMessageCB;
  export type Peers = IPeersCB;
  export type Rpc = IJsonRpcCB;
  export type Info = IInfoCB;
  export type All = Message | Peers | Rpc | Info;
}

export type CBHandler = (response: JsonRpcResponse, cb: IWakuCB.All) => void;
