import * as React from "react";
import { CARET_SVG_URL } from "../assets/caret";


interface WalletButtonProps {
  color: string;
  name: string;
  logo: string;
  href: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

function WalletButton(props:WalletButtonProps) {
  const { color, href, name, logo, onClick } = props;
  return (
    <a
      className="row"
      href={href}
      onClick={onClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      <h3>{name}</h3>
      <div className="right">
        <div className={`app-icon`}
          style={{ background: `url('${logo}') ${color}`, backgroundSize: '100%'}}
        ></div>
        <img src={CARET_SVG_URL} className="caret" />
        
      </div>
    </a>
  );
}

export default WalletButton;

