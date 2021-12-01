# @walletconnect/legacy-modal

Legacy QR Code Modal (v1.0) for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

```js
import WalletConnectQRCodeModal from "@walletconnect/legacy-modal";

/**
 *  Get URI from WalletConnect object
 */
const uri = connector.uri;

/**
 *  Open QR Code Modal
 */
WalletConnectQRCodeModal.open(uri);

/**
 *  Close QR Code Modal
 */
WalletConnectQRCodeModal.close();
```
