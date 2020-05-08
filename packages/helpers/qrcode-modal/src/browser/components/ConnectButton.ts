import { WALLETCONNECT_CONNECT_BUTTON_ID } from "../constants";

interface ConnectButtonProps {
  name: string;
  color: string;
  href: string;
}

function ConnectButton(props: ConnectButtonProps) {
  return `
    <a
      id="${WALLETCONNECT_CONNECT_BUTTON_ID}-${props.name}"
      href="${props.href}"
      target="_blank"
      rel="noopener noreferrer"
      class="walletconnect-connect__button"
      style="background-color: ${props.color};"
    >
      ${props.name}
    </a>
  `;
}

export default ConnectButton;
