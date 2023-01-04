// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

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
    const [svg, setSvg] = useState("");
    const [textArray, setTextArray] = useState<string[]>(["", ""]);

    useEffect(() => {
        (async () => {
            setSvg(await formatQRCodeImage(props.uri, props.qrcodeModalOptions));
        })();
    }, []);

    useEffect(() => {
        if (typeof props.text.scan_qrcode_with_dcentwallet === "undefined") return;
        const splitText: string[] = props.text.scan_qrcode_with_dcentwallet.split("  ") as string[];
        setTextArray(splitText);
    }, [props.text.scan_qrcode_with_dcentwallet]);


    return (
        <div className="walletconnect-qrcode" >
            <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
                {textArray.map(text => <span className="walletconnect-qrcode__explain">{text}</span>)}
            </p>
            <div dangerouslySetInnerHTML={{ __html: svg }}></div>
        </div>
    );
};

export default DcentQRCodeDisplay;
