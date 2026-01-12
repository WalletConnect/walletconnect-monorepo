---
"@walletconnect/core": patch
"@walletconnect/sign-client": patch
"@walletconnect/types": patch
"@walletconnect/utils": patch
"@walletconnect/ethereum-provider": patch
"@walletconnect/universal-provider": patch
---

chore: update @walletconnect/logger to 3.0.2

Updates logger to v3.0.2 which fixes server-side log filtering. The fix ensures `generateServerLogger` uses the `browser.write` option so logs are properly filtered by the configured log level.
