import * as utils from "@walletconnect/utils";

import DeepLinkDisplay from "./DeepLinkDisplay";
import QRCodeDisplay from "./QRCodeDisplay";

import * as logo from "../assets/logo.svg";

interface ModalProps {
  uri: string;
}

function Modal(props: ModalProps) {
  const { uri } = props;
  const content = utils.isMobile() ? DeepLinkDisplay({ uri }) : QRCodeDisplay({ uri });
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

export default Modal;
