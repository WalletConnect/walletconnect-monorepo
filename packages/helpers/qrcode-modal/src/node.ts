const qrTerminal = require("qrcode-terminal");

export function open(uri: string) {
  qrTerminal.generate(uri, { small: true });
}

export function close() {
  // empty
}
