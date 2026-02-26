import { SessionTypes, ProposalTypes } from "@walletconnect/types";

interface ChainIdParams {
  namespace: string;
  reference: string;
}

interface AccountIdParams extends ChainIdParams {
  address: string;
}

const CAIP_DELIMITER = ":";

export function parseChainId(chain: string): ChainIdParams {
  const [namespace, reference] = chain.split(CAIP_DELIMITER);
  return { namespace, reference };
}

export function formatChainId(params: ChainIdParams): string {
  const { namespace, reference } = params;
  return [namespace, reference].join(CAIP_DELIMITER);
}

export function parseAccountId(account: string): AccountIdParams {
  const [namespace, reference, address] = account.split(CAIP_DELIMITER);
  return { namespace, reference, address };
}

export function formatAccountId(params: AccountIdParams): string {
  const { namespace, reference, address } = params;
  return [namespace, reference, address].join(CAIP_DELIMITER);
}

export function getUniqueValues(array: string[], parser: (str: string) => string): string[] {
  const unique: string[] = [];
  array.forEach((str) => {
    const value = parser(str);
    if (!unique.includes(value)) unique.push(value);
  });
  return unique;
}

export function getAddressFromAccount(account: string) {
  const { address } = parseAccountId(account);
  return address;
}

export function getChainFromAccount(account: string) {
  const { namespace, reference } = parseAccountId(account);
  const chain = formatChainId({ namespace, reference });
  return chain;
}

export function formatAccountWithChain(address: string, chain: string) {
  const { namespace, reference } = parseChainId(chain);
  const account = formatAccountId({ namespace, reference, address });
  return account;
}

export function getAddressesFromAccounts(accounts: string[]) {
  return getUniqueValues(accounts, getAddressFromAccount);
}

export function getChainsFromAccounts(accounts: string[]) {
  return getUniqueValues(accounts, getChainFromAccount);
}

export function getAccountsFromNamespaces(
  namespaces: SessionTypes.Namespaces,
  keys: string[] = [],
): string[] {
  const accounts: string[] = [];
  Object.keys(namespaces).forEach((key) => {
    if (keys.length && !keys.includes(key)) return;
    const ns = namespaces[key];
    accounts.push(...ns.accounts);
  });
  return accounts;
}

export function getChainsFromNamespaces(
  namespaces: SessionTypes.Namespaces,
  keys: string[] = [],
): string[] {
  const chains: string[] = [];
  Object.keys(namespaces).forEach((key) => {
    if (keys.length && !keys.includes(key)) return;
    const ns = namespaces[key];
    chains.push(...getChainsFromAccounts(ns.accounts));
  });
  return chains;
}

export function getChainsFromRequiredNamespaces(
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  keys: string[] = [],
): string[] {
  const chains: string[] = [];
  Object.keys(requiredNamespaces).forEach((key) => {
    if (keys.length && !keys.includes(key)) return;
    const ns = requiredNamespaces[key];
    chains.push(...getChainsFromNamespace(key, ns));
  });
  return chains;
}

export function getChainsFromNamespace(
  namespace: string,
  namespaceProps: ProposalTypes.BaseRequiredNamespace,
) {
  // check if chainId is provided in the key as `eip155:1` or in the namespace as chains[]
  return namespace.includes(":") ? [namespace] : namespaceProps.chains || [];
}
