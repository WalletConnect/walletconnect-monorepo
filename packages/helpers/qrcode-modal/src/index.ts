import { IQRCodeModalOptions } from "@dcentwallet/walletconnect-types";
import * as nodeLib from "./node";
import * as browserLib from "./browser";

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

//uri: string, cb: any, qrcodeModalOptions?: IQRCodeModalOptions
function open(uri: string, qrcodeModalOptions?: IQRCodeModalOptions, chainNamespaces?: string[] | undefined) {
  // eslint-disable-next-line no-console
  console.log(uri);
  if (isNode()) {
    nodeLib.open(uri);
  } else {
    browserLib.open(uri, qrcodeModalOptions, chainNamespaces);
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