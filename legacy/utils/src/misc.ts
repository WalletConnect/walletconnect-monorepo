import * as encoding from "@walletconnect/encoding";
import * as jsonRpcUtils from "@walletconnect/jsonrpc-utils";

import { IRpcConfig, INFURA_NETWORKS } from "@walletconnect/legacy-types";

// -- hex -------------------------------------------------- //

export function sanitizeHex(hex: string): string {
  return encoding.sanitizeHex(hex);
}

export function addHexPrefix(hex: string): string {
  return encoding.addHexPrefix(hex);
}

export function removeHexPrefix(hex: string): string {
  return encoding.removeHexPrefix(hex);
}

export function removeHexLeadingZeros(hex: string): string {
  return encoding.removeHexLeadingZeros(encoding.addHexPrefix(hex));
}

// -- id -------------------------------------------------- //

export const payloadId = jsonRpcUtils.payloadId;

export function uuid(): string {
  const result: string = ((a?: any, b?: any) => {
    for (
      b = a = "";
      a++ < 36;
      b += (a * 51) & 52 ? (a ^ 15 ? 8 ^ (Math.random() * (a ^ 20 ? 16 : 4)) : 4).toString(16) : "-"
    ) {
      // empty
    }
    return b;
  })();
  return result;
}

// -- log -------------------------------------------------- //

export function logDeprecationWarning() {
  // eslint-disable-next-line no-console
  console.warn(
    "DEPRECATION WARNING: This WalletConnect client library will be deprecated in favor of @walletconnect/client. Please check docs.walletconnect.org to learn more about this migration!",
  );
}

// -- rpcUrl ----------------------------------------------- //

export function getInfuraRpcUrl(chainId: number, infuraId?: string): string | undefined {
  let rpcUrl: string | undefined;
  const network = INFURA_NETWORKS[chainId];
  if (network) {
    rpcUrl = `https://${network}.infura.io/v3/${infuraId}`;
  }
  return rpcUrl;
}

export function getRpcUrl(chainId: number, rpc: IRpcConfig): string | undefined {
  let rpcUrl: string | undefined;
  const infuraUrl = getInfuraRpcUrl(chainId, rpc.infuraId);
  if (rpc.custom && rpc.custom[chainId]) {
    rpcUrl = rpc.custom[chainId];
  } else if (infuraUrl) {
    rpcUrl = infuraUrl;
  }
  return rpcUrl;
}
