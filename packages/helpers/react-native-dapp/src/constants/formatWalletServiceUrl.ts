import { Platform } from "react-native";

import { WalletService } from "../types";

export default function formatProviderUrl(walletService: WalletService): string {
  const { universalLink, deepLink } = walletService;
  if (Platform.OS === "android") {
    return `${deepLink}`;
  }
  return `${universalLink}`;
}
