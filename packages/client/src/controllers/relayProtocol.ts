import { RelayerTypes } from "@walletconnect/types";
import { RELAY_JSONRPC } from "@walletconnect/relay-api";
import { RELAYER_DEFAULT_PROTOCOL } from "../constants";

export function getRelayProtocolName(
  opts?: RelayerTypes.RequestOptions,
): RelayerTypes.ProtocolOptions {
  return opts?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
}

export function getRelayProtocolApi(protocol: string) {
  const jsonrpc = RELAY_JSONRPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
