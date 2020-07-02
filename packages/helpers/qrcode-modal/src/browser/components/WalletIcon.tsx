import * as React from "react";

interface WalletIconProps {
  color: string;
  logo: string;
  href: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

function WalletIcon(props: WalletIconProps) {
  const { color, href, logo, onClick } = props;
  return (
    <a
      className="walletconnect-connect__button__icon_anchor"
      href={href}
      onClick={onClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      <div
        className="walletconnect-connect__button__icon"
        style={{ background: `url('${logo}') ${color}`, backgroundSize: "100%" }}
      ></div>
    </a>
  );
}

export default WalletIcon;
