// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import copy from "copy-to-clipboard";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Notification from "./Notification";

import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";
import { TextMap } from "../types";
import { IQRCodeModalOptions } from "@dcentwallet/walletconnect-types";

const formatQRCodeImage = async (data: string, qrcodeModalOptions: IQRCodeModalOptions | undefined) => {
    let result = "";
    const modalOptions = qrcodeModalOptions && qrcodeModalOptions;
    const stringifyOptions = JSON.stringify(modalOptions);
    const encodedOptions = btoa(stringifyOptions);
    const DCENT_URL = "https://walletconnect.dcentwallet.com";
    const baseURI = DCENT_URL + "/connect?data=" + data + "&type=desktop" + `&info=${encodedOptions}`;
    const encodeURI = encodeURIComponent(baseURI);
    const doubleEncodeURI = encodeURIComponent(encodeURI);
    const Data = `https://link.dcentwallet.com/DAppBrowser/?url=${doubleEncodeURI}` + "&network=ethereum-mainnet";
    const dataString = await QRCode.toString(Data, { margin: 0, type: "svg" });
    if (typeof dataString === "string") {
        result = dataString.replace("<svg", `<svg class="walletconnect-qrcode__image"`);
    }
    return result;
};
interface QRCodeDisplayProps {
    text: TextMap;
    uri: string;
    qrcodeModalOptions: IQRCodeModalOptions | undefined;
}

const DcentQRCodeDisplay = (props: QRCodeDisplayProps) => {
    //   const [notification, setNotification] = React.useState("");
    const [svg, setSvg] = useState("");
    const [textArray, setTextArray] = useState<string[]>(["", ""]);

    useEffect(() => {
        (async () => {
            setSvg(await formatQRCodeImage(props.uri, props.qrcodeModalOptions));
        })();
        // const splitText = props.text.scan_qrcode_with_dcentwallet?.split(",") as string[];
        // setTextArray(() => [...splitText as string[]]);
    }, []);


    return (
        <div className="walletconnect-qrcode" >
            <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
                {props.text.scan_qrcode_with_dcentwallet}
            </p>
            <div dangerouslySetInnerHTML={{ __html: svg }}></div>
            {/* <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
                {textArray.map(text => <span>{text}</span>)}
            </p>
            <div dangerouslySetInnerHTML={{ __html: svg }}></div> */}

            {/* <div className="walletconnect-modal__footer">
        <a onClick={copyToClipboard}>{props.text.copy_to_clipboard}</a>
      </div>
      <Notification message={notification} /> */}
        </div>
    );
};

export default DcentQRCodeDisplay;
