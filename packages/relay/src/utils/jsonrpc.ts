import { JsonRpcRequest } from "rpc-json-utils";
import { RelayTypes } from "@walletconnect/types";

import { assertType } from "./misc";

export function parseSubscribeRequest(request: JsonRpcRequest): RelayTypes.SubscribeParams {
  const params = request.params as RelayTypes.SubscribeParams;

  assertType(params, "topic");
  assertType(params, "ttl");

  return params;
}

export function parsePublishRequest(request: JsonRpcRequest): RelayTypes.PublishParams {
  const params = request.params as RelayTypes.PublishParams;

  assertType(params, "topic");
  assertType(params, "message");
  assertType(params, "ttl");

  return params;
}
