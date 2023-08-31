import { SessionTypes } from "@walletconnect/types";
import {
  isCaipNamespace,
  isValidObject,
  mergeArrays,
  parseChainId,
  parseNamespaceKey,
} from "@walletconnect/utils";
import { RPC_URL } from "../constants";
import { Namespace, NamespaceConfig } from "../types";
import { merge } from "lodash";

export function getRpcUrl(chainId: string, rpc: Namespace, projectId?: string): string | undefined {
  const chain = parseChainId(chainId);
  return (
    rpc.rpcMap?.[chain.reference] ||
    `${RPC_URL}?chainId=${chain.namespace}:${chain.reference}&projectId=${projectId}`
  );
}

export function getChainId(chain: string): string {
  return chain.includes(":") ? chain.split(":")[1] : chain;
}

export function validateChainApproval(chain: string, chains: string[]): void {
  if (!chains.includes(chain)) {
    throw new Error(
      `Chain '${chain}' not approved. Please use one of the following: ${chains.toString()}`,
    );
  }
}

export function getChainsFromApprovedSession(accounts: string[]): string[] {
  return accounts.map((address) => `${address.split(":")[0]}:${address.split(":")[1]}`);
}

export function getAccountsFromSession(namespace: string, session: SessionTypes.Struct): string[] {
  // match namespaces e.g. eip155 with eip155:1
  const matchedNamespaceKeys = Object.keys(session.namespaces).filter((key) =>
    key.includes(namespace),
  );
  if (!matchedNamespaceKeys.length) return [];
  const accounts: string[] = [];
  matchedNamespaceKeys.forEach((key) => {
    const accountsForNamespace = session.namespaces[key].accounts;
    accounts.push(...accountsForNamespace);
  });
  return accounts;
}

export function mergeRequiredOptionalNamespaces(
  required: NamespaceConfig = {},
  optional: NamespaceConfig = {},
) {
  const requiredNamespaces = normalizeNamespaces(required);
  const optionalNamespaces = normalizeNamespaces(optional);
  return merge(requiredNamespaces, optionalNamespaces);
}

/**
 * Converts
 * {
 *  "eip155:1": {...},
 *  "eip155:2": {...},
 * }
 * into
 * {
 *  "eip155": {
 *      chains: ["eip155:1", "eip155:2"],
 *      ...
 *    }
 * }
 *
 */
export function normalizeNamespaces(namespaces: NamespaceConfig): NamespaceConfig {
  const normalizedNamespaces: NamespaceConfig = {};
  if (!isValidObject(namespaces)) return normalizedNamespaces;

  for (const [key, values] of Object.entries(namespaces)) {
    const chains = isCaipNamespace(key) ? [key] : values.chains;
    const methods = values.methods || [];
    const events = values.events || [];
    const rpcMap = values.rpcMap || {};
    const normalizedKey = parseNamespaceKey(key);
    normalizedNamespaces[normalizedKey] = {
      ...normalizedNamespaces[normalizedKey],
      ...values,
      chains: mergeArrays(chains, normalizedNamespaces[normalizedKey]?.chains),
      methods: mergeArrays(methods, normalizedNamespaces[normalizedKey]?.methods),
      events: mergeArrays(events, normalizedNamespaces[normalizedKey]?.events),
      rpcMap: { ...rpcMap, ...normalizedNamespaces[normalizedKey]?.rpcMap },
    };
  }
  return normalizedNamespaces;
}

export function parseCaip10Account(caip10Account: string): string {
  return caip10Account.includes(":") ? caip10Account.split(":")[2] : caip10Account;
}

/**
 * Populates the chains array for each namespace with the chains extracted from the accounts if are otherwise missing
 */
export function populateNamespacesChains(
  namespaces: SessionTypes.Namespaces,
): Record<string, SessionTypes.Namespace> {
  const parsedNamespaces: Record<string, SessionTypes.Namespace> = {};
  for (const [key, values] of Object.entries(namespaces)) {
    const methods = values.methods || [];
    const events = values.events || [];
    const accounts = values.accounts || [];
    // If the key includes a CAIP separator `:` we know it's a namespace + chainId (e.g. `eip155:1`)
    const chains = isCaipNamespace(key)
      ? [key]
      : values.chains
      ? values.chains
      : getChainsFromApprovedSession(values.accounts);
    parsedNamespaces[key] = {
      chains,
      methods,
      events,
      accounts,
    };
  }
  return parsedNamespaces;
}

export function convertChainIdToNumber(chainId: string | number): number {
  if (typeof chainId === "number") return chainId;
  if (chainId.includes("0x")) {
    return parseInt(chainId, 16);
  }
  return chainId.includes(":") ? Number(chainId.split(":")[1]) : Number(chainId);
}
