---
"@walletconnect/ethereum-provider": patch
---

`EthereumProvider.init` now forwards the `client` and `core` options to `UniversalProvider.init`. Previously they were accepted by the type but silently dropped, so a new Sign Client and Core were always created. Passing an existing `@walletconnect/sign-client` or `@walletconnect/core` instance now reuses it, matching `UniversalProvider.init`.
