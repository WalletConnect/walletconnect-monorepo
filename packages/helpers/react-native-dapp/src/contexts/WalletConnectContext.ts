import registry from "@walletconnect/mobile-registry/registry.json";
import * as React from "react";
import { Image, Platform } from "react-native";

import { WalletConnectContextValue, WalletService } from "../types";

const walletServices: readonly WalletService[] = registry
  .filter(({ universalLink, deepLink }) => {
    /* wc_mobile_valid */
    if (Platform.OS === "ios") {
      return typeof universalLink === "string" && !!universalLink.length;
    } else if (Platform.OS === "android") {
      return typeof deepLink === "string" && !!deepLink.length;
    }
    return Platform.OS === "web";
  })
  .map(({
    logo,
    ...extras
  }: WalletService): WalletService => Object.freeze({
    ...extras,
    logo:
      `https://github.com/WalletConnect/walletconnect-monorepo/raw/next/packages/helpers/mobile-registry${
        logo.substring(1)
      }`,
  }));

/* wc_prefetch */
Promise.all(walletServices.map(({ logo }) => Image.prefetch(logo)));

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectToWalletService: async (walletService: WalletService, uri?: string) => Promise.reject(new Error(
    "[WalletConnect]: It looks like you have forgotten to wrap your application with a <WalletConnectProvider />.",
  )),
  walletServices,
});

export default React.createContext<Partial<WalletConnectContextValue>>(
  defaultValue,
);
