import { IQRCodeModalOptions } from "@walletconnect/types";

import * as nodeLib from "./node";
import * as browserLib from "./browser";
import isElectron from "is-electron";

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

function open(uri: string, cb: any, qrcodeModalOptions?: IQRCodeModalOptions) {
  // eslint-disable-next-line no-console
  console.log(uri);
  if (isNode() && !isElectron()) {
    nodeLib.open(uri);
  } else {
    browserLib.open(uri, cb, qrcodeModalOptions);
  }
}

function close() {
  if (isNode() && !isElectron()) {
    nodeLib.close();
  } else {
    browserLib.close();
  }
}

export default { open, close };
