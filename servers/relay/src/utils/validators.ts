import { LegacySocketMessage, RelayModes } from "../types";

export function isLegacySocketMessage(payload: any): payload is LegacySocketMessage {
  return "topic" in payload && "type" in payload && "payload" in payload;
}

export function isRelayModeLegacy(mode: RelayModes.All): mode is RelayModes.Legacy {
  return mode.toLowerCase() === "legacy";
}

export function isRelayModeJsonRpc(mode: RelayModes.All): mode is RelayModes.JsonRpc {
  return mode.toLowerCase() === "jsonrpc";
}

export function isRelayModeAny(mode: RelayModes.All): mode is RelayModes.JsonRpc {
  return mode.toLowerCase() === "any";
}

export function isLegacyDisabled(mode: RelayModes.All): boolean {
  return !(isRelayModeLegacy(mode) || isRelayModeAny(mode));
}

export function isJsonRpcDisabled(mode: RelayModes.All): boolean {
  return !(isRelayModeJsonRpc(mode) || isRelayModeAny(mode));
}
