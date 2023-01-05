import * as React from "react";
import {
  IMobileRegistryEntry,
  IQRCodeModalOptions,
  IAppRegistry
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
import { WALLETCONNECT_MODAL_ID } from "../constants";
import { TextMap } from "../types";
import DcentQRCodeDisplay from "./DcentQRCodeDisplay";
import DcentLinkDisplay from "./DcentLinkDisplay";

interface ModalProps {
  text: TextMap;
  uri: string;
  onClose: any;
  qrcodeModalOptions?: IQRCodeModalOptions;
}

function Modal(props: ModalProps) {
  // const android = isAndroid();
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
            setDisplayQRCode(true);
          }
          const modalOptions = props.qrcodeModalOptions && props.qrcodeModalOptions as IQRCodeModalOptions;
          const stringifyOptions = JSON.stringify(modalOptions);
          const encodedOptions = btoa(stringifyOptions);
          const DCENT_URL = "https://walletconnect.dcentwallet.com";
          const baseURI = DCENT_URL + "/connect?data=" + props.uri + "&type=mobile" + `&info=${encodedOptions}`;
          const encodeURI = encodeURIComponent(baseURI);
          const doubleEncodeURI = encodeURIComponent(encodeURI);
          const singleLink = `https://link.dcentwallet.com/DAppBrowser/?url=${doubleEncodeURI}` + "&network=ethereum-mainnet";
          setSingleLinkHref(singleLink);
          if (mobile) {
            setDynamicLink(singleLink);

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
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className={`walletconnect-modal__base ${!mobile ? "modal__base--desktop" : ""}`}>
        <Header onClose={props.onClose} />
        {!mobile ? (
          <DcentQRCodeDisplay {...displayProps} />
        ) : (
          <DcentLinkDisplay {...displayProps} links={links} errorMessage={errorMessage} dynamicLink={dynamicLink} />
        )}
      </div>
    </div>
  );
}

export default Modal;
