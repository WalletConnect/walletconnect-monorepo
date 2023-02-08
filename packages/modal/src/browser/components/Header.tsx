// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";

import { WALLETCONNECT_LOGO_SVG_URL } from "../assets/logo";
import { WALLETCONNECT_HEADER_TEXT, WALLETCONNECT_CLOSE_BUTTON_ID } from "../constants";

interface HeaderProps {
  onClose: any;
}

function Header(props: HeaderProps) {
  return (
    <div className="walletconnect-modal__header">
      <img src={WALLETCONNECT_LOGO_SVG_URL} className="walletconnect-modal__headerLogo" />
      <p>{WALLETCONNECT_HEADER_TEXT}</p>
      <div className="walletconnect-modal__close__wrapper" onClick={props.onClose}>
        <div id={WALLETCONNECT_CLOSE_BUTTON_ID} className="walletconnect-modal__close__icon">
          <div className="walletconnect-modal__close__line1"></div>
          <div className="walletconnect-modal__close__line2"></div>
        </div>
      </div>
    </div>
  );
}

export default Header;
