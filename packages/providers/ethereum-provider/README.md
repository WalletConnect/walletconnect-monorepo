# WalletConnect 3ID Provider

3ID Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import ThreeIdProvider from "@walletconnect/3id-provider";

//  Create ThreeIdProvider Provider
const provider = new ThreeIdProvider({
  contractAddress: "0xC5273AbFb36550090095B1EDec019216AD21BE6c",
});

//  Enable session (triggers QR Code modal)
const starkPublicKey = await provider.enable();
```
