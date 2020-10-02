import * as React from "react";
import { isMobile } from "@walletconnect/utils";
import { IQRCodeModalOptions } from "@walletconnect/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import MobileLinkDisplay from "./MobileLinkDisplay";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCodeDisplay from "./QRCodeDisplay";

import { WALLETCONNECT_MODAL_ID, WALLETCONNECT_CLOSE_BUTTON_ID } from "../constants";

import { WALLETCONNECT_LOGO_SVG_URL } from "../assets/logo";

interface ModalProps {
  text: { [key: string]: string };
  uri: string;
  onClose: any;
  qrcodeModalOptions?: IQRCodeModalOptions;
}

function Modal(props: ModalProps) {
  const { text, uri } = props;
  const displayProps = { text, uri };
  const mobile = isMobile();
  const [displayQRCode, setDisplayQRCode] = React.useState(!mobile);
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <div className="walletconnect-modal__header">
          <img src={WALLETCONNECT_LOGO_SVG_URL} className="walletconnect-modal__headerLogo" />
          <p>{"WalletConnect"}</p>
          <div className="walletconnect-modal__close__wrapper" onClick={props.onClose}>
            <div id={WALLETCONNECT_CLOSE_BUTTON_ID} className="walletconnect-modal__close__icon">
              <div className="walletconnect-modal__close__line1"></div>
              <div className="walletconnect-modal__close__line2"></div>
            </div>
          </div>
        </div>
        {mobile && (
          <div
            className={`walletconnect-modal__mobile__toggle${
              !displayQRCode ? " mobile__linking" : ""
            }`}
          >
            <div className="walletconnect-modal__mobile__toggle_selector" />
            <a onClick={() => setDisplayQRCode(true)}>{"QR Code"}</a>
            <a onClick={() => setDisplayQRCode(false)}>{"Mobile"}</a>
          </div>
        )}
        <div>
          {displayQRCode ? (
            <QRCodeDisplay {...displayProps} />
          ) : (
            <MobileLinkDisplay {...displayProps} qrcodeModalOptions={props.qrcodeModalOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;
