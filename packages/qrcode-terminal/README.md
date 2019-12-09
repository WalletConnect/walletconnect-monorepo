# WalletConnect QR Code Terminal

QR Code Terminal for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

```js
import WalletConnectQRCodeTerminal from "@walletconnect/qrcode-terminal";

/**
 *  Get URI from WalletConnect object
 */
const uri = walletConnector.uri;

/**
 *  Generate and log QR Code in terminal
 */
WalletConnectQRCodeTerminal.show(uri)
  .then(() => console.log('QR code generated'!));
