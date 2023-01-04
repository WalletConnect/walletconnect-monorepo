import { ProposalTypes, SessionTypes } from "@walletconnect/types";
import { isValidNamespaces } from "./validators";

export function getAccountsChains(accounts: SessionTypes.Namespace["accounts"]) {
  const chains: string[] = [];
  accounts.forEach((account) => {
    const [chain, chainId] = account.split(":");
    chains.push(`${chain}:${chainId}`);
  });

  return chains;
}

export function getNamespacesChains(namespaces: SessionTypes.Namespaces) {
  const chains: string[] = [];
  Object.values(namespaces).forEach((namespace) => {
    chains.push(...getAccountsChains(namespace.accounts));
    if (namespace.extension) {
      namespace.extension.forEach((extension) => {
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
  Object.values(namespaces).forEach((namespace) => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) methods.push(...namespace.methods);
    if (namespace.extension) {
      namespace.extension.forEach((extension) => {
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
  Object.values(namespaces).forEach((namespace) => {
    const chains = getAccountsChains(namespace.accounts);
    if (chains.includes(chainId)) events.push(...namespace.events);
    if (namespace.extension) {
      namespace.extension.forEach((extension) => {
        const extensionChains = getAccountsChains(extension.accounts);
        if (extensionChains.includes(chainId)) events.push(...extension.events);
      });
    }
  });

  return events;
}

export function getRequiredNamespacesFromNamespaces(
  namespaces: SessionTypes.Namespaces,
  caller: string,
): ProposalTypes.RequiredNamespaces {
  const validNamespacesError = isValidNamespaces(namespaces, caller);
  if (validNamespacesError) throw new Error(validNamespacesError.message);

  const required = {};
  for (const [namespace, values] of Object.entries(namespaces)) {
    required[namespace] = {
      methods: values.methods,
      events: values.events,
      chains: values.accounts.map((account) => `${account.split(":")[0]}:${account.split(":")[1]}`),
    };
  }
  return required;
}
