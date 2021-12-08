import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { IJsonRpcProvider } from "@walletconnect/jsonrpc-types";
import { WsConnection } from "@walletconnect/jsonrpc-ws-connection";
import { formatRelayRpcUrl } from "@walletconnect/utils";

import { RELAYER_DEFAULT_RPC_URL } from "../../constants";

export function formatRelayProvider(
  protocol: string,
  version: number,
  provider?: string | IJsonRpcProvider,
  apiKey?: string,
): IJsonRpcProvider {
  const rpcUrl = formatRelayRpcUrl(
    protocol,
    version,
    typeof provider === "string" ? provider : RELAYER_DEFAULT_RPC_URL,
    apiKey,
  );
  return typeof provider !== "string" && typeof provider !== "undefined"
    ? provider
    : new JsonRpcProvider(new WsConnection(rpcUrl));
}
