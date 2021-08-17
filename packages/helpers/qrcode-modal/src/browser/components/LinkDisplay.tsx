import * as React from "react";
import { IMobileRegistryEntry, IQRCodeModalOptions } from "@walletconnect/types";
import {
  isAndroid,
  formatIOSMobile,
  saveMobileLinkInfo,
} from "@walletconnect/browser-utils";

import { DEFAULT_BUTTON_COLOR, WALLETCONNECT_CTA_TEXT_ID } from "../constants";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ConnectButton from "./ConnectButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletButton from "./WalletButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WalletIcon from "./WalletIcon";
import { TextMap } from "../types";

interface LinkDisplayProps {
  mobile: boolean;
  text: TextMap;
  uri: string;
  qrcodeModalOptions?: IQRCodeModalOptions;
  links: IMobileRegistryEntry[];
  error: boolean;
}

const GRID_MIN_COUNT = 5;
const LINKS_PER_PAGE = 12;

function LinkDisplay(props: LinkDisplayProps) {
  const android = isAndroid();
  const [page, setPage] = React.useState(1);
  const links = props.links;
  const error = props.error;
  const grid = links.length > GRID_MIN_COUNT;
  const pages = Math.ceil(links.length / LINKS_PER_PAGE);
  const range = [(page - 1) * LINKS_PER_PAGE + 1, page * LINKS_PER_PAGE];
  const pageLinks = links.length
    ? links.filter((_, index) => index + 1 >= range[0] && index + 1 <= range[1])
    : [];
  return (
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {android ? props.text.connect_mobile_wallet : props.text.choose_preferred_wallet}
      </p>
      <div
        className={`walletconnect-connect__buttons__wrapper${
          android ? "__android" : grid ? "__wrap" : ""
        }`}
      >
        {!android ? (
          pageLinks.length ? (
            pageLinks.map((entry: IMobileRegistryEntry) => {
              const { color, name, shortName, logo } = entry;
              const href = formatIOSMobile(props.uri, entry);
              const handleClickIOS = React.useCallback(() => {
                saveMobileLinkInfo({
                  name,
                  href,
                });
              }, [pageLinks]);
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
            <>
              <p>{error ? `Something went wrong` : `Loading...`}</p>
            </>
          )
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
      {!!(!android && pages > 1) && (
        <div className="walletconnect-modal__footer">
          {Array(pages)
            .fill(0)
            .map((_, index) => {
              const pageNumber = index + 1;
              const selected = page === pageNumber;
              return (
                <a
                  style={{ margin: "auto 10px", fontWeight: selected ? "bold" : "normal" }}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </a>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default LinkDisplay;
