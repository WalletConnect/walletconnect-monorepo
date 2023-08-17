import { ProposalTypes, SessionTypes } from "@walletconnect/types";
import { mergeArrays } from "./misc";
import { isConformingNamespaces, isValidNamespaces, isValidObject } from "./validators";

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

export type BuildApprovedNamespacesParams = {
  proposal: ProposalTypes.Struct;
  supportedNamespaces: Record<
    string,
    { chains: string[]; methods: string[]; events: string[]; accounts: string[] }
  >;
};

/**
 * util designed for Wallets that builds namespaces structure by provided supported chains, methods, events & accounts.
 * It takes required & optional namespaces provided in the session proposal
 * along with the supported chains/methods/events/accounts by the wallet and returns a structured namespaces object
 * @param {BuildApprovedNamespacesParams} params
 * @returns {SessionTypes.Namespaces}
 */
export function buildApprovedNamespaces(
  params: BuildApprovedNamespacesParams,
): SessionTypes.Namespaces {
  const {
    proposal: { requiredNamespaces, optionalNamespaces = {} },
    supportedNamespaces,
  } = params;
  const normalizedRequired = normalizeNamespaces(requiredNamespaces);
  const normalizedOptional = normalizeNamespaces(optionalNamespaces);

  // build approved namespaces
  const namespaces = {};
  Object.keys(supportedNamespaces).forEach((namespace) => {
    const supportedChains = supportedNamespaces[namespace].chains;
    const supportedMethods = supportedNamespaces[namespace].methods;
    const supportedEvents = supportedNamespaces[namespace].events;
    const supportedAccounts = supportedNamespaces[namespace].accounts;

    supportedChains.forEach((chain) => {
      if (!supportedAccounts.some((account) => account.includes(chain))) {
        throw new Error(`No accounts provided for chain ${chain} in namespace ${namespace}`);
      }
    });

    namespaces[namespace] = {
      chains: supportedChains,
      methods: supportedMethods,
      events: supportedEvents,
      accounts: supportedAccounts,
    };
  });

  // verify all required namespaces are supported
  const err = isConformingNamespaces(requiredNamespaces, namespaces, "approve()");
  if (err) throw new Error(err.message);

  const approvedNamespaces = {};

  // if both required & optional namespaces are empty, return all supported namespaces by the wallet
  if (!Object.keys(requiredNamespaces).length && !Object.keys(optionalNamespaces).length)
    return namespaces;

  // assign accounts for the required namespaces
  Object.keys(normalizedRequired).forEach((requiredNamespace) => {
    const chains = supportedNamespaces[requiredNamespace].chains.filter((chain) =>
      normalizedRequired[requiredNamespace]?.chains?.includes(chain),
    );
    const methods = supportedNamespaces[requiredNamespace].methods.filter((method) =>
      normalizedRequired[requiredNamespace]?.methods?.includes(method),
    );
    const events = supportedNamespaces[requiredNamespace].events.filter((event) =>
      normalizedRequired[requiredNamespace]?.events?.includes(event),
    );

    const accounts = chains
      .map((chain: string) =>
        supportedNamespaces[requiredNamespace].accounts.filter((account: string) =>
          account.includes(`${chain}:`),
        ),
      )
      .flat();

    approvedNamespaces[requiredNamespace] = {
      chains,
      methods,
      events,
      accounts,
    };
  });

  // add optional namespaces
  Object.keys(normalizedOptional).forEach((optionalNamespace) => {
    if (!supportedNamespaces[optionalNamespace]) return;

    const chainsToAdd = normalizedOptional[optionalNamespace]?.chains?.filter((chain) =>
      supportedNamespaces[optionalNamespace].chains.includes(chain),
    );
    const methodsToAdd = supportedNamespaces[optionalNamespace].methods.filter((method) =>
      normalizedOptional[optionalNamespace]?.methods?.includes(method),
    );
    const eventsToAdd = supportedNamespaces[optionalNamespace].events.filter((event) =>
      normalizedOptional[optionalNamespace]?.events?.includes(event),
    );

    const accountsToAdd = chainsToAdd
      ?.map((chain: string) =>
        supportedNamespaces[optionalNamespace].accounts.filter((account: string) =>
          account.includes(`${chain}:`),
        ),
      )
      .flat();

    approvedNamespaces[optionalNamespace] = {
      chains: mergeArrays(approvedNamespaces[optionalNamespace]?.chains, chainsToAdd),
      methods: mergeArrays(approvedNamespaces[optionalNamespace]?.methods, methodsToAdd),
      events: mergeArrays(approvedNamespaces[optionalNamespace]?.events, eventsToAdd),
      accounts: mergeArrays(approvedNamespaces[optionalNamespace]?.accounts, accountsToAdd),
    };
  });

  return approvedNamespaces;
}

export function isCaipNamespace(namespace: string): boolean {
  return namespace.includes(":");
}

export function parseNamespaceKey(namespace: string) {
  return isCaipNamespace(namespace) ? namespace.split(":")[0] : namespace;
}

/**
 * Converts
 * ```
 * {
 *  "eip155:1": {...},
 *  "eip155:2": {...},
 * }
 * ```
 * into
 * ```
 * {
 *  "eip155": {
 *      chains: ["eip155:1", "eip155:2"],
 *      ...
 *    }
 * }
 *```
 */
export function normalizeNamespaces(
  namespaces: ProposalTypes.RequiredNamespaces,
): ProposalTypes.RequiredNamespaces {
  const normalizedNamespaces = {} as ProposalTypes.RequiredNamespaces;
  if (!isValidObject(namespaces)) return normalizedNamespaces;
  for (const [key, values] of Object.entries(namespaces)) {
    const chains = isCaipNamespace(key) ? [key] : values.chains;
    const methods = values.methods || [];
    const events = values.events || [];
    const normalizedKey = parseNamespaceKey(key);
    normalizedNamespaces[normalizedKey] = {
      ...normalizedNamespaces[normalizedKey],
      chains: mergeArrays(chains, normalizedNamespaces[normalizedKey]?.chains),
      methods: mergeArrays(methods, normalizedNamespaces[normalizedKey]?.methods),
      events: mergeArrays(events, normalizedNamespaces[normalizedKey]?.events),
    };
  }
  return normalizedNamespaces;
}
