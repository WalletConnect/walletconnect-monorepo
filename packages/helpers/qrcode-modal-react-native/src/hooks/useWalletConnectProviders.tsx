import * as React from "react";

import type {
  StatefulWalletConnectProviders,
  WalletConnectProvider,
  WalletConnectProviders,
} from "../types";

const REGISTRY_BASE_URL =
  "https://raw.githubusercontent.com/WalletConnect/walletconnect-monorepo/next/packages/helpers/mobile-registry";

export default function useOpenSourceRegistry(): StatefulWalletConnectProviders {
  const [state, setState] = React.useState<StatefulWalletConnectProviders>({
    data: [],
    loading: true,
    error: undefined,
  });

  React.useEffect(() => {
    (async () => {
      try {
        setState((e) => ({ ...e, loading: true }));
        const registry = (await (
          await fetch(`${REGISTRY_BASE_URL}/registry.json`)
        ).json()) as WalletConnectProviders;
        const data = registry.map(
          ({ logo: relativeLogo, ...extras }): WalletConnectProvider => {
            return {
              ...extras,
              logo: `${REGISTRY_BASE_URL}${relativeLogo.substring(1)}`,
            };
          },
        );
        setState({ loading: false, error: undefined, data });
      } catch (error) {
        setState((e) => ({ ...e, error, loading: false }));
      }
    })();
  }, [setState]);

  return state;
}
