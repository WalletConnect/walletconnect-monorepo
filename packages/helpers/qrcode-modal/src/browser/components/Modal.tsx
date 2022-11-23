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
  const [dynamicLink, setDynamicLink] = React.useState("");

  const getLinksIfNeeded = () => {
    if (fetched || loading || (whitelist && !whitelist.length) || links.length > 0) {
      return;
    }

    React.useEffect(() => {
      const initLinks = async () => {
        // if (android) return;
        setLoading(true);
        try {
          const url =
            props.qrcodeModalOptions && props.qrcodeModalOptions.registryUrl
              ? props.qrcodeModalOptions.registryUrl
              : getWalletRegistryUrl();
          const registryResponse = await fetch(url);
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
            console.log(singleLinkHref);
            setDisplayQRCode(true);
          }
          // const encode = encodeURIComponent(props.uri);
          // const attachEncodeURI = "http://192.168.0.235:8080/connect?data=" + encode;
          // const doubleEncode= encodeURIComponent(attachEncodeURI);
          // const trippleEncode = encodeURIComponent(doubleEncode);

          const baseURI = "http://192.168.0.235:8080/connect?data=" + props.uri + "&type=mobile";
          const encodeURI = encodeURIComponent(baseURI);
          const doubleEncodeURI = encodeURIComponent(encodeURI);
          // IOS
          // 
          // console.log("encode", encode);
          // console.log("dobuleEncode",doubleEncode);
          console.log("baseURI ===> ",baseURI);
          console.log("doubleEncodeURI ===>",doubleEncodeURI);
          // const singleLink =`https://link.dcentwallet.com/DAppBrowser/?url=http://192.168.0.235:8080/connect?data=${doubleEncode}`;
          const singleLink =`https://link.dcentwallet.com/DAppBrowser/?url=${doubleEncodeURI}`;
          
          setSingleLinkHref(singleLink);
          console.log("singleLink",singleLink);
          if(mobile) {
            setDynamicLink(singleLink);
            
          }
          // domain
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

        {/* <div>
          {displayQRCode || (!android && !loading && !links.length) ? (
            <QRCodeDisplay {...displayProps} />
          ) : (
            <LinkDisplay {...displayProps} links={links} errorMessage={errorMessage} dynamicLink={dynamicLink}/>
          )}
        </div> */}
        <div>
          {!mobile ? (
            <QRCodeDisplay {...displayProps} />
          ) : (
            <LinkDisplay {...displayProps} links={links} errorMessage={errorMessage} dynamicLink={dynamicLink}/>
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;

// https://link.dcentwallet.com/DAppBrowser/?url=http://192.168.0.235:8080/connect?data=wc%3Af1017bdb-0b89-4872-82aa-3b94d988829f%401%3Fbridge%3Dhttps%253A%252F%252F2.bridge.walletconnect.org%26key%3D74803ff5d5ecdbd148ba473d3bfc09e62a2a0a1a4f030cdc4f03ef9951c89fd2
// https://link.dcentwallet.com/DAppBrowser/?url=http%3A%2F%2F192.168.0.235%3A8080%2Fconnect%3Fdata%3Dwc%253Ae0a3fa2d-8397-468c-a2e1-e3d91603f9b5%25401%253Fbridge%253Dhttps%25253A%25252F%25252Ft.bridge.walletconnect.org%2526key%253D1a760481443d70cf8be020a16ea22a04a1c24d7625a10a761287ce1f90e0461a
// 