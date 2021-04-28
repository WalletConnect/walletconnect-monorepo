import QRCode from "qrcode";

export function open(uri: string) {
  // eslint-disable-next-line no-console
  QRCode.toString(uri, { type: "terminal" }).then(console.log);
}

export function close() {
  // empty
}
