// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import * as QRCode from "qrcode";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Notification from "./Notification";

import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";
import { TextMap } from "../../types";

async function formatQRCodeImage(data: string) {
  let result = "";
  const dataString = await QRCode.toString(data, { margin: 0, type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}

interface QRCodeDisplayProps {
  text: TextMap;
  uri: string;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [notification, setNotification] = React.useState("");
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
    setNotification(props.text.copied_to_clipboard);
    setInterval(() => setNotification(""), 1200);
  };

  return (
    <div>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {props.text.scan_qrcode_with_wallet}
      </p>
      <div dangerouslySetInnerHTML={{ __html: svg }}></div>
      <div className="walletconnect-modal__footer">
        <a onClick={copyToClipboard}>{props.text.copy_to_clipboard}</a>
      </div>
      <Notification message={notification} />
    </div>
  );
}

export default QRCodeDisplay;
