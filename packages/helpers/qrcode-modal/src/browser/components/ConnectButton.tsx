import * as React from "react";

import { WALLETCONNECT_CONNECT_BUTTON_ID } from "../constants";

interface ConnectButtonProps {
  name: string;
  color: string;
  href: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

function ConnectButton(props: ConnectButtonProps) {
  return (
    <a
      className="walletconnect-connect__button"
      href={props.href}
      id={`${WALLETCONNECT_CONNECT_BUTTON_ID}-${props.name}`}
      onClick={props.onClick}
      rel="noopener noreferrer"
      style={{ backgroundColor: props.color }}
      target="_blank"
    >
      {props.name}
    </a>
  );
}

export default ConnectButton;
