import { IQRCodeModalOptions } from "@walletconnect/types";

import * as browserLib from "./browser";
import * as nodeLib from "./node";

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

function open(uri: string, cb: any, qrcodeModalOptions?: IQRCodeModalOptions) {
  console.log(uri); // eslint-disable-line no-console
  if (isNode()) {
    nodeLib.open(uri);
  } else {
    browserLib.open(uri, cb, qrcodeModalOptions);
  }
}

function close() {
  if (isNode()) {
    nodeLib.close();
  } else {
    browserLib.close();
  }
}

export default { close, open };
