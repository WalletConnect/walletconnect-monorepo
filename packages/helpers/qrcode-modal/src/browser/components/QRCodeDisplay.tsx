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
  text: { [key: string]: string };
  uri: string;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [svg, setSvg] = React.useState("");

  React.useEffect(() => {
    (async () => {
      setSvg(await formatQRCodeImage(props.uri));
    })();
  }, []);

  const copyToClipboard = () => {
    const tmp = document.createElement("input");
    tmp.value = props.uri;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
  }

  return (
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {props.text.scan_qrcode_with_wallet}
      </p>
      <div onClick={copyToClipboard} dangerouslySetInnerHTML={{ __html: svg }}></div>
    </div>
  );
}

export default QRCodeDisplay;
