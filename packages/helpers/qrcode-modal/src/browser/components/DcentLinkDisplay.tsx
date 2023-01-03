import React, { useCallback } from "react";
import { IMobileRegistryEntry, IQRCodeModalOptions } from "@dcentwallet/walletconnect-types";
import { isAndroid, formatIOSMobile, saveMobileLinkInfo } from "@walletconnect/browser-utils";

import { DEFAULT_BUTTON_COLOR, WALLETCONNECT_CTA_TEXT_ID } from "../constants";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ConnectButton from "./ConnectButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletButton from "./WalletButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletIcon from "./WalletIcon";
import { TextMap } from "../types";
import ConnectDcentButton from "./ConnectDcentButton";

interface LinkDisplayProps {
  mobile: boolean;
  text: TextMap;
  uri: string;
  qrcodeModalOptions?: IQRCodeModalOptions;
  links: IMobileRegistryEntry[];
  errorMessage: string;
  dynamicLink: string;
}

const GRID_MIN_COUNT = 5;
const LINKS_PER_PAGE = 12;

const DcentLinkDisplay = (props: LinkDisplayProps) => {
  const android = isAndroid();
  const [input, setInput] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const links = filter
    ? props.links.filter(link => link.name.toLowerCase().includes(filter.toLowerCase()))
    : props.links;
  const errorMessage = props.errorMessage;
  const grid = filter || links.length > GRID_MIN_COUNT;
  const pages = Math.ceil(links.length / LINKS_PER_PAGE);
  const range = [(page - 1) * LINKS_PER_PAGE + 1, page * LINKS_PER_PAGE];
  const pageLinks = links.length
    ? links.filter((_, index) => index + 1 >= range[0] && index + 1 <= range[1])
    : [];
  const hasPaging = !!(!android && pages > 1);
  let filterTimeout: any = undefined;
  function handleInput(e) {
    setInput(e.target.value);
    clearTimeout(filterTimeout);
    if (e.target.value) {
      filterTimeout = setTimeout(() => {
        setFilter(e.target.value);
        setPage(1);
      }, 1000);
    } else {
      setInput("");
      setFilter("");
      setPage(1);
    }
  }

  return (
    <div style={{ maxWidth: "450px" }}>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text mobile-text">
        {props.text.connect_dcent}
      </p>
      <div className="dcent-walletconnect__button-wrapper">
      <ConnectDcentButton
        name={props.text.connect}
        dynamicLink={props.dynamicLink}
        onClick={useCallback(() => {
          saveMobileLinkInfo({
            name: "Unknown",
            href: props.dynamicLink,
          });
        }, [])}
      />
      </div>
    </div>
  );
};

export default DcentLinkDisplay;
