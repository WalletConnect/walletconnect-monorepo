import * as React from "react";
import { IMobileRegistryEntry, IQRCodeModalOptions } from "@walletconnect/types";
import { isAndroid, formatIOSMobile, saveMobileLinkInfo } from "@walletconnect/browser-utils";

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
  errorMessage: string;
}

const GRID_MIN_COUNT = 5;
const LINKS_PER_PAGE = 12;

function LinkDisplay(props: LinkDisplayProps) {
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
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {android ? props.text.connect_mobile_wallet : props.text.choose_preferred_wallet}
      </p>
      {!android && (
        <input
          className={`walletconnect-search__input`}
          placeholder="Search"
          value={input}
          onChange={handleInput}
        />
      )}
      <div
        className={`walletconnect-connect__buttons__wrapper${
          android ? "__android" : grid && links.length ? "__wrap" : ""
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
                  name={shortName || name}
                  logo={logo}
                  onClick={handleClickIOS}
                />
              );
            })
          ) : (
            <>
              <p>
                {errorMessage.length
                  ? props.errorMessage
                  : !!props.links.length && !links.length
                  ? props.text.no_wallets_found
                  : props.text.loading}
              </p>
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
      {hasPaging && (
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
