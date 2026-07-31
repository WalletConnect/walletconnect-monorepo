---
"@walletconnect/utils": patch
"@walletconnect/pay": patch
"@walletconnect/pos-client": patch
"@walletconnect/react-native-compat": patch
"@walletconnect/signer-connection": patch
"@walletconnect/ethereum-provider": patch
---

Remove unused declared dependencies (`@walletconnect/safe-json` from utils, `@walletconnect/types` from pay, `@walletconnect/core` and `@walletconnect/jsonrpc-provider` from pos-client, `events` from react-native-compat, `uint8arrays` from signer-connection, `@walletconnect/jsonrpc-provider`, `@walletconnect/jsonrpc-utils` and `@walletconnect/sign-client` from ethereum-provider). No runtime changes.
