import { RelayTypes } from "@walletconnect/types";

export function isPublishParams(params: any): params is RelayTypes.PublishParams {
  return "message" in params && "topic" in params && "ttl" in params;
}

export function isSubscribeParams(params: any): params is RelayTypes.SubscribeParams {
  return "topic" in params && "ttl" in params;
}
