# WalletConnect Starkware Provider

Starkware Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import StarkwareProvider from "@walletconnect/starkware-provider";

//  Create StarkwareProvider Provider
const provider = new StarkwareProvider({
  contractAddress: "0xC5273AbFb36550090095B1EDec019216AD21BE6c",
});

//  Enable session (triggers QR Code modal)
const starkPublicKey = await provider.enable("starkex", "starkexdvf", "0");
```
