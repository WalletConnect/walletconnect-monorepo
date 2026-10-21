---
"@walletconnect/ethereum-provider": minor
---

Support wallet launches and the wallet fee. On a host launch (`window.walletConnectHost`), `connect()` and `enable()` no longer open the QR modal, since Universal Provider hands the pairing URI to the host. Add `EthereumProvider.isHostLaunch()` (also a `provider.isHostLaunch` getter), `getWalletFee()` for `provider.chainId`, the `wallet_fee_changed` event and the `WalletFee` type, and pass the `walletFeeApiUrl` option through to Universal Provider.
