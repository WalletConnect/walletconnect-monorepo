import { SessionTypes } from "@walletconnect/types";

export function getAccountsChains(accounts: SessionTypes.NamespaceBody["accounts"]) {
  const chains: string[] = [];
  accounts.forEach(account => {
    const [chain, chainId] = account.split(":");
    chains.push(`${chain}:${chainId}`);
  });

  return chains;
}

export function getNamespacesChains(namespaces: SessionTypes.Namespaces) {
  const chains: string[] = [];
  Object.values(namespaces).forEach(namespace => {
    chains.push(...getAccountsChains(namespace.accounts));
  });

  return chains;
}

export function getNamespacesMethodsForChainId(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
) {
  const methods: SessionTypes.NamespaceBody["methods"] = [];
  Object.values(namespaces).forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) methods.push(...namespace.methods);
  });

  return methods;
}

export function getNamespacesEventsForChainId(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
) {
  const events: SessionTypes.NamespaceBody["events"] = [];
  Object.values(namespaces).forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) events.push(...namespace.events);
  });

  return events;
}
