import { JsonRpcResult, JsonRpcError } from "@json-rpc-tools/utils";
export interface WakuPeers {
  multiaddr: string;
  protocol: string;
  connected: boolean;
}

export interface WakuMessage {
  payload: string;
  filterTopic: string;
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
  messages: WakuMessage[];
  pagingOptions?: PagingOptions;
}

export interface IMessageCB {
  (error: JsonRpcError | undefined, m: WakuMessage[]): void;
}

export interface IJsonRpcCB {
  (result: JsonRpcError | JsonRpcResult): void;
}
