import { appendToQueryString } from "@walletconnect/utils";
import { Platform } from "react-native";

// https://github.com/WalletConnect-Labs/walletconnect-qrcode-modal/blob/b38b6a91b1f91d63592a97c22f80a63f76e5e489/src/browser.ts#L32
export default function formatWebRedirect(): string {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line functional/no-throw-statement
    throw new Error("formatDeepLinkHref may not be called on mobile platforms.");
  }
  // @ts-ignore
  const redirectUrlQueryString = appendToQueryString(window.location.search, {
    walletconnect: true,
  });
  return encodeURIComponent(
    // @ts-ignore
    `${window.location.origin}${window.location.pathname}${redirectUrlQueryString}`,
  );
}
