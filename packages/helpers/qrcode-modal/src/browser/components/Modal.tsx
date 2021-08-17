import * as React from "react";
import { IMobileRegistryEntry, IQRCodeModalOptions, IAppRegistry, IMobileLinkInfo } from "@walletconnect/types";
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
  const whitelist =
    props.qrcodeModalOptions && props.qrcodeModalOptions.mobileLinks
      ? props.qrcodeModalOptions.mobileLinks
      : undefined;
  const mobile = isMobile();
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
  const [error, setError] = React.useState(false);

  const getLinksIfNeeded = () => {
    if (links.length > 0) { return }

    React.useEffect(() => {
      const initMobileLinks = async () => {
        if (android) return;
        try {
          const url = getWalletRegistryUrl();
          const registry = (await fetch(url).then(x => x.json())) as IAppRegistry;
          const platform = mobile ? "mobile" : "desktop";
          const _links = getMobileLinkRegistry(formatMobileRegistry(registry, platform), whitelist);
          setError(false);
          setLinks(_links);
          const hasSingleLink = _links.length === 1;
          if (hasSingleLink) {
            setSingleLinkHref(formatIOSMobile(props.uri, _links[0]));
          }
          setHasSingleLink(hasSingleLink);
        } catch (e) {
          setError(true)
          console.error(e); // eslint-disable-line no-console
        }
      };
      initMobileLinks();
    });
  }

  getLinksIfNeeded();

  const rightSelected = mobile ? displayQRCode : !displayQRCode;
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <Header onClose={props.onClose} />
        {
        hasSingleLink && displayQRCode ?

        <div className="walletconnect-modal__single_wallet">
          <a 
            onClick={() => saveMobileLinkInfo({name: links[0].name, href: singleLinkHref})}
            href={singleLinkHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            {props.text.connect_with + " " + (hasSingleLink ? links[0].name : "") + " ›"}
          </a>
        </div>

        :

        <div
          className={`walletconnect-modal__mobile__toggle${
            rightSelected ? " right__selected" : ""
          }`}
        >
          <div className="walletconnect-modal__mobile__toggle_selector" />
          {mobile ? (
            <>
              <a onClick={() => (setDisplayQRCode(false), getLinksIfNeeded())}>{props.text.mobile}</a>
              <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
            </>
          ) : (
            <>
              <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
              <a onClick={() => (setDisplayQRCode(false), getLinksIfNeeded())}>{props.text.desktop}</a>
            </>
          )}
        </div>
        }
        
        <div>
          {displayQRCode ? <QRCodeDisplay {...displayProps} /> : 
          <LinkDisplay {...displayProps} links={links} error={error}/>}
        </div>
      </div>
    </div>
  );
}

export default Modal;
