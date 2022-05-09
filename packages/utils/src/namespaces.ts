import { SessionTypes } from "@walletconnect/types";

export function getNamespacesChains(namespaces: SessionTypes.Namespace[]) {
  const chains: SessionTypes.Namespace["chains"] = [];
  namespaces.forEach(namespace => chains.push(...namespace.chains));

  return chains;
}

export function getNamespacesMethodsForChainId(
  namespaces: SessionTypes.Namespace[],
  chainId: string,
) {
  const methods: SessionTypes.Namespace["methods"] = [];
  namespaces.forEach(namespace => {
    if (namespace.chains.includes(chainId)) methods.push(...namespace.methods);
  });

  return methods;
}

export function getNamespacesEventsForChainId(
  namespaces: SessionTypes.Namespace[],
  chainId: string,
) {
  const events: SessionTypes.Namespace["events"] = [];
  namespaces.forEach(namespace => {
    if (namespace.chains.includes(chainId)) events.push(...namespace.events);
  });

  return events;
}
