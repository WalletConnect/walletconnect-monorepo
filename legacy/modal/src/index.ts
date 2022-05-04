import { IQRCodeModalOptions } from "@walletconnect/legacy-types";

import * as nodeLib from "./node";
import * as browserLib from "./browser";

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined" &&
  typeof process.versions.electron === "undefined";

function open(uri: string, cb: any, qrcodeModalOptions?: IQRCodeModalOptions) {
  // eslint-disable-next-line no-console
  console.log(uri);
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

export default { open, close };
