---
"@walletconnect/pay": minor
"@walletconnect/react-native-compat": minor
---

WalletConnect Pay: `confirmPayment` now takes `data`, whose elements may be plain signature strings or JSON objects/arrays (e.g. TRON's `{raw_data_hex, signature}` confirm payload), forwarded to the gateway as JSON. `signatures` is deprecated and used as a fallback when `data` is omitted. Bumps yttrium to 0.10.59 (WASM blob + iOS YttriumWrapper) and 0.10.60 (Android yttrium-wcpay).
