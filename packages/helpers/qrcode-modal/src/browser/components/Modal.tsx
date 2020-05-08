// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DeepLinkDisplay from "./DeepLinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";

import { isMobile } from "../helpers";
import {
  WALLETCONNECT_MODAL_ID,
  WALLETCONNECT_CLOSE_BUTTON_ID,
  WALLETCONNECT_LOGO_SVG_URL,
} from "../constants";

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
          <div className="walletconnect-modal__close__wrapper">
            <div
              id={WALLETCONNECT_CLOSE_BUTTON_ID}
              className="walletconnect-modal__close__icon"
              onClick={props.onClose}
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
          <a onClick={() => setDisplayQRCode(!displayQRCode)}>
            {displayQRCode
              ? "Display mobile options again!"
              : "Want to display QR Code instead? Click here"}
          </a>
        )}
      </div>
    </div>
  );
}

export default Modal;
