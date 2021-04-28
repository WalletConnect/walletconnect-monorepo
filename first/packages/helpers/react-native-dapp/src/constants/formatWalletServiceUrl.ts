import { Platform } from "react-native";

import { WalletService } from "../types";

export default function formatProviderUrl(walletService: WalletService): string {
  const { mobile } = walletService;
  const { universal: universalLink, native: deepLink } = mobile;
  if (Platform.OS === "android") {
    return `${deepLink}`;
  }
  return `${universalLink}`;
}
