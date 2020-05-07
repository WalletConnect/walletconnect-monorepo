import MobileRegistry from "@walletconnect/mobile-registry";
import { IMobileRegistryEntry } from "@walletconnect/types";
import { safeGetFromWindow, appendToQueryString, isIOS } from "@walletconnect/utils";

import { defaultColor } from "../constants";
import ConnectButton from "./ConnectButton";

function formatIOSDeepLink(uri: string, entry: IMobileRegistryEntry) {
  const loc = safeGetFromWindow<Location>("location");
  const encodedUri: string = encodeURIComponent(uri);
  const redirectUrlQueryString = appendToQueryString(loc.search, {
    walletconnect: true,
  });
  const redirectUrl: string = encodeURIComponent(
    `${loc.origin}${loc.pathname}${redirectUrlQueryString}`,
  );

  return entry.universalLink
    ? `${entry.universalLink}/wc?uri=${encodedUri}&redirectUrl=${redirectUrl}`
    : entry.deepLink
    ? `{wallet.deepLink}${uri}`
    : "";
}

interface DeepLinkDisplayProps {
  uri: string;
}

function DeepLinkDisplay(props: DeepLinkDisplayProps) {
  const { uri } = props;
  let content: string;
  if (isIOS()) {
    const buttons = MobileRegistry.map((entry: IMobileRegistryEntry) => {
      const { name, color } = entry;
      const href = formatIOSDeepLink(uri, entry);
      return ConnectButton({ name, color, href });
    });
    content = buttons.join("");
  } else {
    content = ConnectButton({ name: "Connect to Mobile Wallet", color: defaultColor, href: uri });
  }
  const callToAction = "Choose your preferred wallet";
  return `
    <div>
      <p id="walletconnect-qrcode-text" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      <div class="walletconnect-connect__buttons__wrapper">
        ${content}
      </div>
    </div>
  `;
}

export default DeepLinkDisplay;
