import * as browserLib from "./browser";
import * as nodeLib from "./node";
import { isNode } from "@walletconnect/utils";

function open(uri: string, cb: any) {
  if (isNode()) {
    nodeLib.open(uri);
  } else {
    browserLib.open(uri, cb);
  }
}

function close() {
  if (isNode()) {
    nodeLib.close();
  } else {
    browserLib.close();
  }
}

export const browser = browserLib;
export const node = nodeLib;

export default { open, close };
