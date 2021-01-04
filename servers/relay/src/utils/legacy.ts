import { JsonRpcPayload } from "@json-rpc-tools/types";
import { LegacySocketMessage } from "../types";

export function isLegacySocketMessage(payload: any): payload is LegacySocketMessage {
  return "topic" in payload && "type" in payload && "payload" in payload;
}

export function isJsonRpcPayload(payload: any): payload is JsonRpcPayload {
  return "id" in payload && "jsonrpc" in payload && payload.jsonrpc === "2.0";
}
