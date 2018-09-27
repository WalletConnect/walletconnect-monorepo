# WalletConnect QR Code Modal

This implements provider for walletconnect standard.

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import WalletConnectQRCode from 'walletconnect-qrcode-modal'

/**
 *  Get URI from WalletConnect object
 */
const uri = webConnector.uri

/**
 *  Open QR Code Modal
 */
WalletConnectQRCode.openQRCode(uri)

/**
 *  Close QR Code Modal
 */
WalletConnectQRCode.closeQRCode()
```
