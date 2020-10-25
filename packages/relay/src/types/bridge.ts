export interface BridgeSubscribeParams {
  topic: string;
  ttl: number;
}

export interface BridgePublishParams {
  topic: string;
  message: string;
  ttl: number;
}

export interface BridgeSubscriptionParams {
  topic: string;
  message: string;
}

export interface BridgeUnsubscribeParams {
  topic: string;
}
