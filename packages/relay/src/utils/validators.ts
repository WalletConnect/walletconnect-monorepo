import { BridgePublishParams, BridgeSubscribeParams } from "../types";

export function isBridgePublish(params: any): params is BridgePublishParams {
  return "message" in params && "topic" in params && "ttl" in params;
}

export function isBridgeSubscribe(
  params: any
): params is BridgeSubscribeParams {
  return "topic" in params && "ttl" in params;
}
