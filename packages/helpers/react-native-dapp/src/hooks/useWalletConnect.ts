import WalletConnect from "@walletconnect/client";
import * as React from "react";

import useWalletConnectContext from "./useWalletConnectContext";

export type useWalletConnectResult = {
  readonly connector?: WalletConnect;
  readonly connected: boolean;
};

export default function useWalletConnect(): WalletConnect  {
  const { connector } = useWalletConnectContext();
  return React.useMemo((): WalletConnect => {
    if (connector) {
      return connector;
    }
    return Object.freeze({
      connected: false,
    }) as WalletConnect;
  }, [connector]);
}
