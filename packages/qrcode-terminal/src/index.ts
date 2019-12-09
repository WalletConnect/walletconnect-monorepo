const qrTerminal = require("qrcode-terminal");

async function show(uri: string, cb?: any): Promise<void> {
  return new Promise(resolve => {
    qrTerminal.generate(uri, { small: true }, (qr: string) => {
      if (cb) {
        cb(qr);
      }
      console.log(qr);
      resolve();
    });
  });
}

export default { show };
