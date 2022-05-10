import { SessionTypes } from "@walletconnect/types";

export function getAccountsChains(accounts: SessionTypes.Namespace["accounts"]) {
  const chains: string[] = [];
  accounts.forEach(account => {
    const [chain] = account.split(":");
    chains.push(chain);
  });

  return chains;
}

export function getNamespacesChains(namespaces: SessionTypes.Namespace[]) {
  const chains: string[] = [];
  namespaces.forEach(namespace => {
    chains.push(...getAccountsChains(namespace.accounts));
  });

  return chains;
}

export function getNamespacesMethodsForChainId(
  namespaces: SessionTypes.Namespace[],
  chainId: string,
) {
  const methods: SessionTypes.Namespace["methods"] = [];
  namespaces.forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) methods.push(...namespace.methods);
  });

  return methods;
}

export function getNamespacesEventsForChainId(
  namespaces: SessionTypes.Namespace[],
  chainId: string,
) {
  const events: SessionTypes.Namespace["events"] = [];
  namespaces.forEach(namespace => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) events.push(...namespace.events);
  });

  return events;
}
