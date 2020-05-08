import * as qrImage from "qr-image";
import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";

function formatQRCodeImage(data: string) {
  let result = "";
  const dataString = qrImage.imageSync(data, { type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg className="walletconnect-qrcode__image"`);
  }
  return result;
}

interface QRCodeDisplayProps {
  uri: string;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const content = formatQRCodeImage(props.uri);
  const callToAction = "Scan QR code with a WalletConnect-compatible wallet";
  return `
    <div>
      <p id="${WALLETCONNECT_CTA_TEXT_ID}" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      ${content}
    </div>
  `;
}

export default QRCodeDisplay;
