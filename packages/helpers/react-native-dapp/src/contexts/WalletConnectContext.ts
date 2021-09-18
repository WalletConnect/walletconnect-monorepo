import * as React from "react";
import { Linking } from "react-native";

import { WalletConnectContextValue, WalletService } from "../types";

const defaultValue: Partial<WalletConnectContextValue> = Object.freeze({
  bridge: "https://bridge.walletconnect.org",
  clientMeta: {
    description: "Connect with WalletConnect",
    url: "https://walletconnect.org",
    icons: ["https://walletconnect.org/walletconnect-logo.png"],
    name: "WalletConnect",
  },
  storageOptions: {
    rootStorageKey: "@walletconnect/qrcode-modal-react-native",
  },
  // By default, redirect the user to download a wallet.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConnectFail: (uri: string) => Linking.openURL("https://walletconnect.org/wallets"),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectToWalletService: async (walletService: WalletService, uri?: string) => Promise.reject(new Error(
    "[WalletConnect]: It looks like you have forgotten to wrap your application with a <WalletConnectProvider />.",
  )),
  walletServices: [],
});

export default React.createContext<Partial<WalletConnectContextValue>>(
  defaultValue,
);
