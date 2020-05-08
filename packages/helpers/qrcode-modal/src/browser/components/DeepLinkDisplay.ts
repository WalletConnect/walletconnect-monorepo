import MobileRegistry from "@walletconnect/mobile-registry";

import { isIOS, safeGetFromWindow, appendToQueryString } from "../helpers";
import { DEFAULT_BUTTON_COLOR, WALLETCONNECT_CTA_TEXT_ID } from "../constants";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ConnectButton from "./ConnectButton";

interface IMobileRegistryEntry {
  name: string;
  color: string;
  universalLink: string;
  deepLink: string;
  chromeIntent: string;
}

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
    content = ConnectButton({
      name: "Connect to Mobile Wallet",
      color: DEFAULT_BUTTON_COLOR,
      href: uri,
    });
  }
  const callToAction = "Choose your preferred wallet";
  return `
    <div>
      <p id="${WALLETCONNECT_CTA_TEXT_ID}" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      <div class="walletconnect-connect__buttons__wrapper">
        ${content}
      </div>
    </div>
  `;
}

export default DeepLinkDisplay;
