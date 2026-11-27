---
"@walletconnect/universal-provider": minor
---

Add `getWalletFee()` and the `wallet_fee_changed` event. On a host launch where the wallet approves the session with a `wallet_guide_id` session property, Universal Provider loads the wallet's fee config for the app from the WalletConnect API, and `getWalletFee()` returns the whole config: `feeBps`, `referralCode` and the recipients, each parsed into a CAIP-2 `chainId` and an `address`. Apps pick the recipient for the chain they transact on. The config is refetched on `session_update` and cleared on disconnect. The new `walletFeeApiUrl` option overrides the API base URL, which defaults to `https://api.walletconnect.com`. The `WalletFee` type is exported.
