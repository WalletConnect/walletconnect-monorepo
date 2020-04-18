import * as browserLib from "./browser";

function open(uri: string, cb: any) {
  browserLib.open(uri, cb);
}

function close() {
  browserLib.close();
}

export default { open, close };
