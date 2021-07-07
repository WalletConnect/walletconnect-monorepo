import * as React from "react";
import { isMobile } from "@walletconnect/browser-utils";
import { IQRCodeModalOptions } from "@walletconnect/types";

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
  const mobile = isMobile();
  const [displayQRCode, setDisplayQRCode] = React.useState(!mobile);
  const displayProps = {
    mobile,
    text: props.text,
    uri: props.uri,
    qrcodeModalOptions: props.qrcodeModalOptions,
  };
  const rightSelected = mobile ? displayQRCode : !displayQRCode;
  return (
    <div id={WALLETCONNECT_MODAL_ID} className="walletconnect-qrcode__base animated fadeIn">
      <div className="walletconnect-modal__base">
        <Header onClose={props.onClose} />
        <div
          className={`walletconnect-modal__mobile__toggle${
            rightSelected ? " right__selected" : ""
          }`}
        >
          <div className="walletconnect-modal__mobile__toggle_selector" />
          {mobile ? (
            <>
              <a onClick={() => setDisplayQRCode(false)}>{props.text.mobile}</a>
              <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
            </>
          ) : (
            <>
              <a onClick={() => setDisplayQRCode(true)}>{props.text.qrcode}</a>
              <a onClick={() => setDisplayQRCode(false)}>{props.text.desktop}</a>
            </>
          )}
        </div>
        <div>
          {displayQRCode ? <QRCodeDisplay {...displayProps} /> : <LinkDisplay {...displayProps} />}
        </div>
      </div>
    </div>
  );
}

export default Modal;
