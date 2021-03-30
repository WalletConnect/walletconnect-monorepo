export interface WakuPeers {
  multiaddr: string;
  protocol: string;
  connected: boolean;
}

export interface WakuMessage {
  payload: Uint8Array;
  contentTopic: number;
  version: number;
  proof: Uint8Array;
}
