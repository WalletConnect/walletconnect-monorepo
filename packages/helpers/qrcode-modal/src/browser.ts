import MobileRegistry from "@walletconnect/mobile-registry";
import * as types from "@walletconnect/types";
import * as utils from "@walletconnect/utils";
import * as qrImage from "qr-image";

import * as logo from "./logo.svg";
import * as constants from "./constants";
import "./style.css";

function formatQRCodeImage(data: string) {
  let result = "";
  const dataString = qrImage.imageSync(data, { type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}

function formatQRCodeContent(uri: string) {
  const qrCodeImage = formatQRCodeImage(uri);
  const callToAction = "Scan QR code with a WalletConnect-compatible wallet";
  return `
    <div>
      <p id="walletconnect-qrcode-text" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      ${qrCodeImage}
    </div>
  `;
}

function formatDeepLinkHref(uri: string, entry: types.IMobileRegistryEntry) {
  const loc = utils.safeGetFromWindow<Location>("location");
  const encodedUri: string = encodeURIComponent(uri);
  const redirectUrlQueryString = utils.appendToQueryString(loc.search, {
    walletconnect: true,
  });
  const redirectUrl: string = encodeURIComponent(
    `${loc.origin}${loc.pathname}${redirectUrlQueryString}`,
  );

  return entry.universalLink
    ? `${entry.universalLink}/wc?uri=${encodedUri}&redirectUrl=${redirectUrl}`
    : entry.deepLink
    ? `{wallet.deepLink}${uri}`
    : "";
}

function formatSingleConnectButton(name: string, color: string, href: string) {
  return `
    <a
      id="walletconnect-connect-button-${name}"
      href="${href}"
      target="_blank"
      rel="noopener noreferrer"
      class="walletconnect-connect__button"
      style="background-color: ${color};"
    >
      ${name}
    </a>
  `;
}
function formatMobileRegistry(uri: string) {
  const buttons = MobileRegistry.map((entry: types.IMobileRegistryEntry) => {
    const { name, color } = entry;
    const href = formatDeepLinkHref(uri, entry);
    return formatSingleConnectButton(name, color, href);
  });
  return buttons.join("");
}

function formatSingleDeepLink(uri: string) {
  const name = "Connect to Mobile Wallet";
  const color = constants.defaultColor;
  return formatSingleConnectButton(name, color, uri);
}

function formateDeepLinkingContent(uri: string) {
  const content = utils.isIOS() ? formatMobileRegistry(uri) : formatSingleDeepLink(uri);
  const callToAction = "Choose your preferred wallet";
  return `
    <div>
      <p id="walletconnect-qrcode-text" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      <div class="walletconnect-connect__buttons__wrapper">
        ${content}
      </div>
    </div>
  `;
}

function formatModal(uri: string) {
  const content = utils.isMobile() ? formateDeepLinkingContent(uri) : formatQRCodeContent(uri);
  return `
  <div
    id="walletconnect-qrcode-modal"
    class="walletconnect-qrcode__base animated fadeIn"
  >
    <div class="walletconnect-modal__base">
      <div class="walletconnect-modal__header">
        <img src="${logo}" class="walletconnect-modal__headerLogo" />
        <div class="walletconnect-modal__close__wrapper">
          <div
            id="walletconnect-qrcode-close"
            class="walletconnect-modal__close__icon"
          >
            <div class="walletconnect-modal__close__line1""></div>
            <div class="walletconnect-modal__close__line2"></div>
          </div>
        </div>
      </div>
      <div>
        ${content}
      </div>
    </div>
  </div>
`;
}

export function open(uri: string, cb: any) {
  const doc = utils.safeGetFromWindow<Document>("document");
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("id", "walletconnect-wrapper");

  wrapper.innerHTML = formatModal(uri);

  doc.body.appendChild(wrapper);
  const closeButton = doc.getElementById("walletconnect-qrcode-close");

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      close();
      if (cb) {
        cb();
      }
    });
  }
}

/**
 *  @desc     Close WalletConnect QR Code Modal
 */
export function close() {
  const doc = utils.safeGetFromWindow<Document>("document");
  const elm = doc.getElementById("walletconnect-qrcode-modal");
  if (elm) {
    elm.className = elm.className.replace("fadeIn", "fadeOut");
    setTimeout(() => {
      const wrapper = doc.getElementById("walletconnect-wrapper");
      if (wrapper) {
        doc.body.removeChild(wrapper);
      }
    }, constants.animationDuration);
  }
}
