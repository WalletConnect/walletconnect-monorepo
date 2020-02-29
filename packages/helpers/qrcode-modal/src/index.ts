import browser from "./browser";
import node from "./node";
import { isBrowser } from "@walletconnect/utils";

function open(uri: string, cb: any) {
  if (isBrowser()) {
    browser.open(uri, cb);
  } else {
    node.open(uri);
  }
}

function close() {
  if (isBrowser()) {
    browser.close();
  } else {
    node.close();
  }
}

export default { open, close };
