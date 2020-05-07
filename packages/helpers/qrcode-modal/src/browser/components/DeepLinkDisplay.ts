import MobileRegistry from "@walletconnect/mobile-registry";
import * as types from "@walletconnect/types";
import * as utils from "@walletconnect/utils";

import * as constants from "../constants";
import ConnectButton from "./ConnectButton";

function formatIOSDeepLink(uri: string, entry: types.IMobileRegistryEntry) {
  const loc = utils.safeGetFromWindow<Location>("location");
  const encodedUri: string = encodeURIComponent(uri);
  const redirectUrlQueryString = utils.appendToQueryString(loc.search, {
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
  if (utils.isIOS()) {
    const buttons = MobileRegistry.map((entry: types.IMobileRegistryEntry) => {
      const { name, color } = entry;
      const href = formatIOSDeepLink(uri, entry);
      return ConnectButton({ name, color, href });
    });
    content = buttons.join("");
  } else {
    const name = "Connect to Mobile Wallet";
    const color = constants.defaultColor;
    content = ConnectButton({ name, color, href: uri });
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
