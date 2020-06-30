// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import QRCode from "qrcode";
import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";

async function formatQRCodeImage(data: string) {
  let result = "";
  const dataString = await QRCode.toString(data, { type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}

interface QRCodeDisplayProps {
  uri: string;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [svg, setSvg] = React.useState("");
  React.useEffect(() => {
    (async () => {
      setSvg(await formatQRCodeImage(props.uri));
    })();
  }, []);
  return (
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {"Scan QR code with a WalletConnect-compatible wallet"}
      </p>
      <div dangerouslySetInnerHTML={{ __html: svg }}></div>
    </div>
  );
}

export default QRCodeDisplay;
