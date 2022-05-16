import { SessionTypes } from "@walletconnect/types";

export function getAccountsChains(accounts: SessionTypes.Namespace["accounts"]) {
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
    if (namespace.extension) {
      namespace.extension.forEach(extension => {
        chains.push(...getAccountsChains(extension.accounts));
      });
    }
  });

  return chains;
}

export function getNamespacesMethodsForChainId(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
) {
  const methods: SessionTypes.Namespace["methods"] = [];
  Object.values(namespaces).forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) methods.push(...namespace.methods);
    if (namespace.extension) {
      namespace.extension.forEach(extension => {
        const extensionChains = getAccountsChains(extension.accounts);
        if (extensionChains.includes(chainId)) methods.push(...extension.methods);
      });
    }
  });

  return methods;
}

export function getNamespacesEventsForChainId(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
) {
  const events: SessionTypes.Namespace["events"] = [];
  Object.values(namespaces).forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) events.push(...namespace.events);
    if (namespace.extension) {
      namespace.extension.forEach(extension => {
        const extensionChains = getAccountsChains(extension.accounts);
        if (extensionChains.includes(chainId)) events.push(...extension.events);
      });
    }
  });

  return events;
}
