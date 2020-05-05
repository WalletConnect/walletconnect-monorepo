import * as browserLib from "./browser";
import * as nodeLib from "./node";
import * as utils from "@walletconnect/utils";

function open(uri: string, cb: any) {
  if (utils.isNode()) {
    nodeLib.open(uri);
  } else {
    browserLib.open(uri, cb);
  }
}

function close() {
  if (utils.isNode()) {
    nodeLib.close();
  } else {
    browserLib.close();
  }
}

export default { open, close };
