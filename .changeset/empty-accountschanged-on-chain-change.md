---
"@walletconnect/universal-provider": patch
---

Fixed `accountsChanged` being emitted with an empty array when the default chain changes to a chain the session does not (yet) list accounts for. This can happen when a `wallet_switchEthereumChain` request for a chain outside the approved namespace is forwarded to the wallet and the provider's default chain is updated before the wallet's `session_update` (which adds the chain's accounts) arrives, or when the wallet emits a `chainChanged` session event without accounts for that chain. EIP-1193 consumers such as wagmi's `walletConnect` connector and Reown AppKit treat an empty `accountsChanged` as a disconnection and may delete the WalletConnect session. A chain change with no accounts for the new chain no longer emits `accountsChanged`, and keeps the previously emitted accounts until the session is updated.

Refs: https://github.com/WalletConnect/walletconnect-monorepo/issues/7392
