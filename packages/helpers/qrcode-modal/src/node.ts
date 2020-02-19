const qrTerminal = require("qrcode-terminal");

function open(uri: string) {
  qrTerminal.generate(uri, { small: true });
}

function close() {
  // do nothing
}

export default { open, close };
