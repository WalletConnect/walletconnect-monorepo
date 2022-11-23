// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import QRCode from "qrcode";
import copy from "copy-to-clipboard";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Notification from "./Notification";

import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";
import { TextMap } from "../types";

async function formatQRCodeImage(data: string) {
  console.log("qr data",data);
  let result = "";
  // const encode = encodeURIComponent(data);
  const baseURI = "http://192.168.0.235:8080/connect?data=" + data + "&type=desktop";
  const encodeURI = encodeURIComponent(baseURI);
  const doubleEncodeURI = encodeURIComponent(encodeURI);
  // const Data = `https://link.dcentwallet.com/DAppBrowser/?url=http://192.168.0.235:8080/connect?data=${doubleEncode}`;
  const Data = `https://link.dcentwallet.com/DAppBrowser/?url=${doubleEncodeURI}`;
  console.log("full data", Data);
  const dataString = await QRCode.toString(Data, { margin: 0, type: "svg" });
  if (typeof dataString === "string") {
    result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
  }
  return result;
}
// key walletconnect
// value {"connected":true,"accounts":["0x5956995E7e689257279097c09b8FE5319Bd1034F"],"chainId":1,"bridge":"https://v.bridge.walletconnect.org","key":"69d0d26544e950027f164d55967916e617d3ac6b00f525f4a1741749d8535888","clientId":"dffaabf6-4894-4406-94b8-74978f33a8d8","clientMeta":{"description":"","url":"http://localhost:8060","icons":["http://localhost:8060/favicon.ico"],"name":"WalletConnect Example"},"peerId":"76e8b77e48521330","peerMeta":{"description":"D'CENT Biometric Hardware Wallet","icons":[],"name":"Dcent","url":"https://dcentwallet.com/"},"handshakeId":1669089529994139,"handshakeTopic":"ca157533-0fb1-4eaa-8b0f-e464dd977fe8"}

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
