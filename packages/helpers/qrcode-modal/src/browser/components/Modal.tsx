// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import { isMobile } from "@walletconnect/utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DeepLinkDisplay from "./DeepLinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";

import { WALLETCONNECT_MODAL_ID, WALLETCONNECT_CLOSE_BUTTON_ID } from "../constants";

import { WALLETCONNECT_LOGO_SVG_URL } from "../assets/logo";

interface ModalProps {
  uri: string;
  onClose: any;
}

function Modal(props: ModalProps) {
  const mobile = isMobile();
  const [displayQRCode, setDisplayQRCode] = React.useState(!mobile);
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <div className="walletconnect-modal__header">
          <img src={WALLETCONNECT_LOGO_SVG_URL} className="walletconnect-modal__headerLogo" />
          <p>WalletConnect</p>
          <div className="walletconnect-modal__close__wrapper" onClick={props.onClose}>
            <div
              id={WALLETCONNECT_CLOSE_BUTTON_ID}
              className="walletconnect-modal__close__icon"
            >
              <div className="walletconnect-modal__close__line1"></div>
              <div className="walletconnect-modal__close__line2"></div>
            </div>
          </div>
        </div>
        <div>
          {displayQRCode ? <QRCodeDisplay uri={props.uri} /> : <DeepLinkDisplay uri={props.uri} />}
        </div>
        {mobile && (
          <div className="walletconnect-modal__footer">
            <a onClick={() => setDisplayQRCode(!displayQRCode)}>
              {displayQRCode ? "Return to mobile wallet options" : "View QR code instead"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
