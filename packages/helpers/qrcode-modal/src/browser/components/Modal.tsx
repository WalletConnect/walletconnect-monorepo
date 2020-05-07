// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import { isMobile } from "@walletconnect/utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DeepLinkDisplay from "./DeepLinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";

import * as logo from "../assets/logo.svg";
import { WALLETCONNECT_MODAL_ID, WALLETCONNECT_CLOSE_BUTTON_ID } from "../constants";

interface ModalProps {
  uri: string;
}

function Modal(props: ModalProps) {
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <div className="walletconnect-modal__header">
          <img src={logo} className="walletconnect-modal__headerLogo" />
          <div className="walletconnect-modal__close__wrapper">
            <div id={WALLETCONNECT_CLOSE_BUTTON_ID} className="walletconnect-modal__close__icon">
              <div className="walletconnect-modal__close__line1"></div>
              <div className="walletconnect-modal__close__line2"></div>
            </div>
          </div>
        </div>
        <div>
          {isMobile() ? <DeepLinkDisplay uri={props.uri} /> : <QRCodeDisplay uri={props.uri} />}
        </div>
      </div>
    </div>
  );
}

export default Modal;
