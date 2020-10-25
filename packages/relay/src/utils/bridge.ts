import { JsonRpcRequest } from "rpc-json-utils";
import { BridgePublishParams, BridgeSubscribeParams } from "../types";
import { assertType } from "./misc";

export function parseBridgeSubscribe(
  request: JsonRpcRequest
): BridgeSubscribeParams {
  const params = request.params as BridgeSubscribeParams;

  assertType(params, "topic");
  assertType(params, "ttl");

  return params;
}

export function parseBridgePublish(
  request: JsonRpcRequest
): BridgePublishParams {
  const params = request.params as BridgePublishParams;

  assertType(params, "topic");
  assertType(params, "message");
  assertType(params, "ttl");

  return params;
}
