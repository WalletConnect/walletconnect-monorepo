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
  formatMobileRegistryEntry,
} from "@walletconnect/browser-utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Header from "./Header";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import LinkDisplay from "./LinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";
import PairingDisplay from "./PairingDisplay";

import { WALLETCONNECT_MODAL_ID } from "../constants";
import { TextMap } from "../types";

interface ModalProps {
  text: TextMap;
  uri: string;
  chains: string[];
  pairings: any[];
  onPairingSelected: (pairingTopic: string) => void;
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

  const hasExistingPairings = props.pairings.length;

  const [activeTab, setActiveTab] = React.useState<"deeplinks" | "qrcode" | "pairings">(
    hasExistingPairings ? "pairings" : mobile ? "deeplinks" : "qrcode",
  );

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

  // TODO: modify in browser-utils pkg instead of inlining here.
  function formatMobileRegistry(
    registry: IAppRegistry,
    targetChains: string[],
    platform: "mobile" | "desktop" = "mobile",
  ): IMobileRegistryEntry[] {
    return Object.values(registry)
      .filter((entry) => {
        // Filter out entries that do not have a universal or native link for this platform.
        const hasPlatformLink = !!entry[platform].universal || !!entry[platform].native;
        // Filter out entries that do not support the selected chains.
        const supportsChains = targetChains.every((targetChain) =>
          entry.chains.includes(targetChain),
        );
        return hasPlatformLink && supportsChains;
      })

      .map((entry) => formatMobileRegistryEntry(entry, platform));
  }

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
          const registryResponse = await fetch(url);
          const registry = (await registryResponse.json()).listings as IAppRegistry;
          const platform = mobile ? "mobile" : "desktop";
          // TODO: check handling/rendering for empty _links result.
          const _links = getMobileLinkRegistry(
            formatMobileRegistry(registry, props.chains, platform),
            whitelist,
          );
          setLoading(false);
          setFetched(true);
          setErrorMessage(!_links.length ? props.text.no_supported_wallets : "");
          console.log(_links);

          setLinks(_links);
          const hasSingleLink = _links.length === 1;
          if (hasSingleLink) {
            setSingleLinkHref(formatIOSMobile(props.uri, _links[0]));
            setActiveTab("qrcode");
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

  // On mobile deeplinks are the middle tab, on desktop the the QRCode
  const middleTabSelected = mobile ? activeTab === "deeplinks" : activeTab === "qrcode";
  // Right tab is selected if neither pairings tab is active nor the middle tab.
  const rightTabSelected = activeTab !== "pairings" && !middleTabSelected;
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <Header onClose={props.onClose} />
        {hasSingleLink && activeTab === "qrcode" ? (
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
            className={`walletconnect-modal__mobile__toggle ${
              rightTabSelected ? "right__selected" : ""
            } ${middleTabSelected ? "middle__selected" : ""}`}
          >
            <div className="walletconnect-modal__mobile__toggle_selector" />
            <a
              onClick={() => {
                setActiveTab("pairings");
              }}
            >
              {props.text.pairings}
            </a>
            {mobile ? (
              <>
                <a onClick={() => (setActiveTab("deeplinks"), getLinksIfNeeded())}>
                  {props.text.mobile}
                </a>
                <a onClick={() => setActiveTab("qrcode")}>{props.text.qrcode}</a>
              </>
            ) : (
              <>
                <a onClick={() => setActiveTab("qrcode")}>{props.text.qrcode}</a>
                <a onClick={() => (setActiveTab("deeplinks"), getLinksIfNeeded())}>
                  {props.text.desktop}
                </a>
              </>
            )}
          </div>
        ) : null}

        <div>
          {activeTab === "pairings" ? (
            <PairingDisplay
              text={props.text}
              pairings={props.pairings}
              onPairingSelected={props.onPairingSelected}
            />
          ) : activeTab === "qrcode" || (!android && !loading && !links.length) ? (
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
