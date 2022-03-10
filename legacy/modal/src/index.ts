import { IQRCodeModalOptions } from "@walletconnect/types";

import * as nodeLib from "./node";
import * as browserLib from "./browser";

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

// FIXME: use appropriate type for `pairings` here
function open(opts: {
  uri: string;
  chains: string[];
  pairings: any[];
  onPairingSelected: (pairingTopic: string) => void;
  cb: any;
  qrcodeModalOptions?: IQRCodeModalOptions;
}) {
  // eslint-disable-next-line no-console
  console.log(opts.uri);
  if (isNode()) {
    nodeLib.open(opts.uri);
  } else {
    browserLib.open(opts);
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
