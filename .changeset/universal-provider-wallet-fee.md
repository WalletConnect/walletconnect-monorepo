---
"@walletconnect/universal-provider": minor
---

Add `getWalletFee()` and the `wallet_fee_changed` event. On a host launch where the wallet approves the session with a `wallet_guide_id` session property, Universal Provider loads the wallet's fee config for the app from the WalletConnect API, and `getWalletFee()` returns the `feeBps`, `referralCode` and recipient address for the active chain. The fee is recomputed when the chain changes and cleared on disconnect. The new `walletFeeApiUrl` option overrides the API base URL, which defaults to `https://api.walletconnect.com`. The `WalletFee` type is exported.
