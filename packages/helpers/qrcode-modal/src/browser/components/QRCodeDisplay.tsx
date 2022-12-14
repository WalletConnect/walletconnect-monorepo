// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import QRCode from "qrcode";
import copy from "copy-to-clipboard";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Notification from "./Notification";

import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";
import { TextMap } from "../types";
import { IQRCodeModalOptions } from "@walletconnect/types";

async function formatQRCodeImage(data: string, qrcodeModalOptions: IQRCodeModalOptions | undefined) {
  console.log("qr data", data);
  let result = "";
  const modalOptions = qrcodeModalOptions && qrcodeModalOptions;
  const stringifyOptions = JSON.stringify(modalOptions);
  const encodedOptions = btoa(stringifyOptions);
  const baseURI = "http://192.168.0.235:8080/connect?data=" + data + "&type=desktop" +`&info=${encodedOptions}`;
  const encodeURI = encodeURIComponent(baseURI);
  const doubleEncodeURI = encodeURIComponent(encodeURI) ;
  const Data = `https://link.dcentwallet.com/DAppBrowser/?url=${doubleEncodeURI}`;
  console.log("full data", Data);
  const dataString = await QRCode.toString(Data, { margin: 0, type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}
interface QRCodeDisplayProps {
  text: TextMap;
  uri: string;
  qrcodeModalOptions: IQRCodeModalOptions | undefined;
}

function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [notification, setNotification] = React.useState("");
  const [svg, setSvg] = React.useState("");

  React.useEffect(() => {
    (async () => {
      setSvg(await formatQRCodeImage(props.uri, props.qrcodeModalOptions));
    })();
  }, []);

  const copyToClipboard = () => {
    const success = copy(props.uri);
    if (success) {
      setNotification(props.text.copied_to_clipboard);
      setInterval(() => setNotification(""), 1200);
    } else {
      setNotification("Error");
      setInterval(() => setNotification(""), 1200);
    }
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
