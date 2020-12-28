import * as React from "react";
import { IMobileRegistryEntry, IQRCodeModalOptions } from "@walletconnect/types";
import { isIOS, mobileLinkChoiceKey, setLocal } from "@walletconnect/utils";

import { DEFAULT_BUTTON_COLOR, WALLETCONNECT_CTA_TEXT_ID } from "../constants";

import { MOBILE_REGISTRY } from "../assets/registry";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ConnectButton from "./ConnectButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletButton from "./WalletButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletIcon from "./WalletIcon";
import { TextMap } from "../types";

function formatIOSMobile(uri: string, entry: IMobileRegistryEntry) {
  const encodedUri: string = encodeURIComponent(uri);
  return entry.universalLink
    ? `${entry.universalLink}/wc?uri=${encodedUri}`
    : entry.deepLink
    ? `${entry.deepLink}${entry.deepLink.endsWith(":") ? "//" : "/"}wc?uri=${encodedUri}`
    : "";
}

function saveMobileLinkInfo(data: IMobileLinkInfo) {
  const focusUri = data.href.split("?")[0];
  setLocal(mobileLinkChoiceKey, { ...data, href: focusUri });
}

function getMobileRegistryEntry(name: string): IMobileRegistryEntry {
  return MOBILE_REGISTRY.filter((entry: IMobileRegistryEntry) =>
    entry.name.toLowerCase().includes(name),
  )[0];
}

function getMobileLinkRegistry(qrcodeModalOptions?: IQRCodeModalOptions) {
  let links = MOBILE_REGISTRY;
  if (
    qrcodeModalOptions &&
    qrcodeModalOptions.mobileLinks &&
    qrcodeModalOptions.mobileLinks.length
  ) {
    links = qrcodeModalOptions.mobileLinks.map((name: string) => getMobileRegistryEntry(name));
  }
  return links;
}

interface IMobileLinkInfo {
  name: string;
  href: string;
}
interface MobileLinkDisplayProps {
  qrcodeModalOptions?: IQRCodeModalOptions;
  text: TextMap;
  uri: string;
}

function MobileLinkDisplay(props: MobileLinkDisplayProps) {
  const ios = isIOS();
  const links = getMobileLinkRegistry(props.qrcodeModalOptions);
  const [showMore, setShowMore] = React.useState(false);
  const grid = links.length > 5;
  const displayShowMore = links.length > 12;
  return (
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {ios ? props.text.choose_preferred_wallet : props.text.connect_mobile_wallet}
      </p>
      <div
        className={`walletconnect-connect__buttons__wrapper${
          !ios ? "__android" : grid ? "__wrap" : ""
        }`}
      >
        {ios ? (
          links.map((entry: IMobileRegistryEntry, idx: number) => {
            const { color, name, shortName, logo } = entry;
            const href = formatIOSMobile(props.uri, entry);
            const handleClickIOS = React.useCallback(() => {
              saveMobileLinkInfo({
                name,
                href,
              });
            }, []);
            if (idx > 11 && !showMore) return;
            return !grid ? (
              <WalletButton
                color={color}
                href={href}
                name={name}
                logo={logo}
                onClick={handleClickIOS}
              />
            ) : (
              <WalletIcon
                color={color}
                href={href}
                name={shortName}
                logo={logo}
                onClick={handleClickIOS}
              />
            );
          })
        ) : (
          <ConnectButton
            name={props.text.connect}
            color={DEFAULT_BUTTON_COLOR}
            href={props.uri}
            onClick={React.useCallback(() => {
              saveMobileLinkInfo({
                name: "Unknown",
                href: props.uri,
              });
            }, [])}
          />
        )}
      </div>
      {!!(ios && displayShowMore) && (
        <div className="walletconnect-modal__footer">
          <a onClick={() => setShowMore(!showMore)}>
            {showMore ? props.text.show_less : props.text.show_more}
          </a>
        </div>
      )}
    </div>
  );
}

export default MobileLinkDisplay;
