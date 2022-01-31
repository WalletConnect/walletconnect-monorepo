import * as React from "react";
import {
  IMobileRegistryEntry,
  IQRCodeModalOptions,
  IAppRegistry,
  IMobileLinkInfo,
} from "@walletconnect/types";
import {
  isMobile,
  isAndroid,
  formatIOSMobile,
  saveMobileLinkInfo,
  getMobileLinkRegistry,
  getWalletRegistryUrl,
  formatMobileRegistry,
} from "@walletconnect/browser-utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Header from "./Header";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import LinkDisplay from "./LinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";

import { WALLETCONNECT_MODAL_ID } from "../constants";
import { TextMap } from "../types";

interface ModalProps {
  text: TextMap;
  uri: string;
  onClose: any;
  qrcodeModalOptions?: IQRCodeModalOptions;
}

function Modal(props: ModalProps) {
  const android = isAndroid();
  const mobile = isMobile();

  const whitelist = mobile
    ? props.qrcodeModalOptions && props.qrcodeModalOptions.mobileLinks
      ? props.qrcodeModalOptions.mobileLinks
      : undefined
    : props.qrcodeModalOptions && props.qrcodeModalOptions.desktopLinks
    ? props.qrcodeModalOptions.desktopLinks
    : undefined;
  const [loading, setLoading] = React.useState(false);
  const [fetched, setFetched] = React.useState(false);
  const [displayQRCode, setDisplayQRCode] = React.useState(!mobile);
  const displayProps = {
    mobile,
    text: props.text,
    uri: props.uri,
    qrcodeModalOptions: props.qrcodeModalOptions,
  };

  const [singleLinkHref, setSingleLinkHref] = React.useState("");
  const [hasSingleLink, setHasSingleLink] = React.useState(false);
  const [links, setLinks] = React.useState<IMobileRegistryEntry[]>([]);
  const [errorMessage, setErrorMessage] = React.useState("");

  const getLinksIfNeeded = () => {
    if (fetched || loading || (whitelist && !whitelist.length) || links.length > 0) {
      return;
    }

    React.useEffect(() => {
      const initLinks = async () => {
        if (android) return;
        setLoading(true);
        try {
          const url =
            props.qrcodeModalOptions && props.qrcodeModalOptions.registryUrl
              ? props.qrcodeModalOptions.registryUrl
              : getWalletRegistryUrl();
          const registryResponse = await fetch(url)
          const registry = (await registryResponse.json()).listings as IAppRegistry;
          const platform = mobile ? "mobile" : "desktop";
          const _links = getMobileLinkRegistry(formatMobileRegistry(registry, platform), whitelist);
          setLoading(false);
          setFetched(true);
          setErrorMessage(!_links.length ? props.text.no_supported_wallets : "");
          setLinks(_links);
          const hasSingleLink = _links.length === 1;
          if (hasSingleLink) {
            setSingleLinkHref(formatIOSMobile(props.uri, _links[0]));
            setDisplayQRCode(true);
          }
          setHasSingleLink(hasSingleLink);
        } catch (e) {
          setLoading(false);
          setFetched(true);
          setErrorMessage(props.text.something_went_wrong);
          console.error(e); // eslint-disable-line no-console
        }
      };
      initLinks();
    });
  };

  getLinksIfNeeded();

  const rightSelected = mobile ? displayQRCode : !displayQRCode;
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <Header onClose={props.onClose} />
        {hasSingleLink && displayQRCode ? (
          <div className="walletconnect-modal__single_wallet">
            <a
              onClick={() => saveMobileLinkInfo({ name: links[0].name, href: singleLinkHref })}
              href={singleLinkHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              {props.text.connect_with + " " + (hasSingleLink ? links[0].name : "") + " ›"}
            </a>
          </div>
        ) : android || loading || (!loading && links.length) ? (
          <div
            className={`walletconnect-modal__mobile__toggle${
              rightSelected ? " right__selected" : ""
            }`}
          >
            <div className="walletconnect-modal__mobile__toggle_selector" />
            {mobile ? (
              <>
                <a onClick={() => (setDisplayQRCode(false), getLinksIfNeeded())}>
                  {props.text.mobile}
                </a>
                <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
              </>
            ) : (
              <>
                <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
                <a onClick={() => (setDisplayQRCode(false), getLinksIfNeeded())}>
                  {props.text.desktop}
                </a>
              </>
            )}
          </div>
        ) : null}

        <div>
          {displayQRCode || (!android && !loading && !links.length) ? (
            <QRCodeDisplay {...displayProps} />
          ) : (
            <LinkDisplay {...displayProps} links={links} errorMessage={errorMessage} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;
