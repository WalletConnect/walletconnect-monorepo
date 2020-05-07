import * as qrImage from "qr-image";

function formatQRCodeImage(data: string) {
  let result = "";
  const dataString = qrImage.imageSync(data, { type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}

interface QRCodeDisplayProps {
  uri: string;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const qrCodeImage = formatQRCodeImage(props.uri);
  const callToAction = "Scan QR code with a WalletConnect-compatible wallet";
  return `
    <div>
      <p id="walletconnect-qrcode-text" class="walletconnect-qrcode__text">
        ${callToAction}
      </p>
      ${qrCodeImage}
    </div>
  `;
}

export default QRCodeDisplay;
