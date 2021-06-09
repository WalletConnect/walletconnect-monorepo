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

export interface WakuMessagesResult {
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
  messages: WakuMessagesResult[];
  pagingOptions?: PagingOptions;
}
