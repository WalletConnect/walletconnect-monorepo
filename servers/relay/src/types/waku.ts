import { JsonRpcResponse, JsonRpcResult, JsonRpcError } from "@json-rpc-tools/utils";
export interface WakuPeers {
  multiaddr: string;
  protocol: string;
  connected: boolean;
}

export interface WakuMessage {
  payload: string;
  contentTopic: string;
  version: number;
  timestamp: string;
  proof: Uint8Array;
}

export interface WakuMessageResponse {
  payload: Uint8Array;
  contentTopic: string;
  version: number;
  timestamp: string;
  proof: Uint8Array;
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
  messages: WakuMessage[];
  pagingOptions?: PagingOptions;
}

export interface IMessageCB {
  (error: JsonRpcError | undefined, m: WakuMessage[]): void;
}

export interface IJsonRpcCB {
  (result: JsonRpcError | JsonRpcResult): void;
}
