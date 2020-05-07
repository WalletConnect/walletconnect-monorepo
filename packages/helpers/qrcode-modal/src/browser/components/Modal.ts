import { isMobile } from "@walletconnect/utils";

import DeepLinkDisplay from "./DeepLinkDisplay";
import QRCodeDisplay from "./QRCodeDisplay";

import * as logo from "../assets/logo.svg";
import { WALLETCONNECT_MODAL_ID, WALLETCONNECT_CLOSE_BUTTON_ID } from "../constants";

interface ModalProps {
  uri: string;
}

function Modal(props: ModalProps) {
  const { uri } = props;
  const content = isMobile() ? DeepLinkDisplay({ uri }) : QRCodeDisplay({ uri });
  return `
  <div
    id="${WALLETCONNECT_MODAL_ID}"
    class="walletconnect-qrcode__base animated fadeIn"
  >
    <div class="walletconnect-modal__base">
      <div class="walletconnect-modal__header">
        <img src="${logo}" class="walletconnect-modal__headerLogo" />
        <div class="walletconnect-modal__close__wrapper">
          <div
            id="${WALLETCONNECT_CLOSE_BUTTON_ID}"
            class="walletconnect-modal__close__icon"
          >
            <div class="walletconnect-modal__close__line1"></div>
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
