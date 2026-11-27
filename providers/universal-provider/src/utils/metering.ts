import { parseNamespaceKey } from "@walletconnect/utils";

import { SIGNING_METHODS } from "../constants/index.js";

/**
 * Whether `method` on `chainId` (CAIP-2) is a signing request that counts as SIGN_SUCCESS.
 */
export function isSigningMethod(chainId: string, method: string): boolean {
  return SIGNING_METHODS[parseNamespaceKey(chainId)]?.includes(method) ?? false;
}
