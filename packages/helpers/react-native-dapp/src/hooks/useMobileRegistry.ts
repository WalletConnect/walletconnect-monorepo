import * as React from "react";

import { WalletService } from "../types";

type State = {
  readonly data: readonly WalletService[]; // TODO
  readonly error?: Error;
  readonly loading: boolean;
};

const defaultState: State = Object.freeze({
  data: [],
  error: undefined,
  loading: true,
});

export default function useMobileRegistry(): State {
  const [state, setState] = React.useState<State>(defaultState);

  React.useEffect(() => {
    (async () => {
      try {
        const result = await fetch("https://registry.walletconnect.org/data/wallets.json");
        const data = await result.json();
        setState({
          data: Object.values(data) as readonly WalletService[],
          error: undefined,
          loading: false,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setState({ ...defaultState, error: error as any, loading: false });
      }
    })();
  }, [setState]);

  return state;
}
