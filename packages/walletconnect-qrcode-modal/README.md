# WalletConnect QR Code Modal

QR Code Modal for WalletConnect Standard

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import WalletConnectQRCodeModal from 'walletconnect-qrcode-modal'

/**
 *  Get URI from WalletConnect object
 */
const uri = webConnector.uri

/**
 *  Open QR Code Modal
 */
WalletConnectQRCodeModal.open(uri)

/**
 *  Close QR Code Modal
 */
WalletConnectQRCodeModal.close()
```
