import * as nodeLib from "./node";
import * as browserLib from "./browser";
import { QRCodeModalOptions } from "./types";
import { isNode } from "./utils";

function open(uri: string, cb: any, qrcodeModalOptions?: QRCodeModalOptions) {
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

export default { open, close };
