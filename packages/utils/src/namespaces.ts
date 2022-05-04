import { SessionTypes } from "@walletconnect/types";

export function getNamespacesChains(namespaces: SessionTypes.Namespace[]) {
  const chains: SessionTypes.Namespace["chains"] = [];
  namespaces.forEach(namespace => chains.push(...namespace.chains));

  return chains;
}
