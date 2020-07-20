import * as React from "react";
import { IMobileRegistryEntry } from "@walletconnect/types";
import { isIOS, mobileLinkChoiceKey, setLocal } from "@walletconnect/utils";

import { DEFAULT_BUTTON_COLOR, WALLETCONNECT_CTA_TEXT_ID } from "../constants";

import { MOBILE_REGISTRY } from "../assets/registry";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ConnectButton from "./ConnectButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletButton from "./WalletButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletIcon from "./WalletIcon";

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

function shouldDisplayOption(name: string, mobileLinkOptions: string[]): boolean {
  let display = false;
  mobileLinkOptions.forEach(option => {
    if (name.toLowerCase().includes(option.toLowerCase())) {
      display = true;
    }
  });
  return display;
}

function getMobileLinkRegistry(mobileLinkOptions?: string[]) {
  let links = MOBILE_REGISTRY;
  if (mobileLinkOptions && mobileLinkOptions.length) {
    links = MOBILE_REGISTRY.filter((entry: IMobileRegistryEntry) =>
      shouldDisplayOption(entry.name, mobileLinkOptions),
    );
  }
  return links;
}

interface IMobileLinkInfo {
  name: string;
  href: string;
}
interface MobileLinkDisplayProps {
  mobileLinkOptions?: string[];
  text: { [key: string]: string };
  uri: string;
}

function MobileLinkDisplay(props: MobileLinkDisplayProps) {
  const ios = isIOS();
  const links = getMobileLinkRegistry(props.mobileLinkOptions);
  const grid = MOBILE_REGISTRY.length >= 5;
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
          links.map((entry: IMobileRegistryEntry) => {
            const { color, name, logo } = entry;
            const href = formatIOSMobile(props.uri, entry);
            const handleClickIOS = React.useCallback(() => {
              saveMobileLinkInfo({
                name,
                href,
              });
            }, []);
            return !grid ? (
              <WalletButton
                color={color}
                href={href}
                name={name}
                logo={logo}
                onClick={handleClickIOS}
              />
            ) : (
              <WalletIcon color={color} href={href} logo={logo} onClick={handleClickIOS} />
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
    </div>
  );
}

export default MobileLinkDisplay;
