---
"@walletconnect/utils": patch
"@walletconnect/types": patch
"@walletconnect/core": patch
"@walletconnect/sign-client": patch
"@walletconnect/universal-provider": patch
"@walletconnect/ethereum-provider": patch
"@walletconnect/signer-connection": patch
"@walletconnect/react-native-compat": patch
---

Import `ox` through its `ox/Secp256k1` and `ox/Signature` subpaths so importing `@walletconnect/utils` no longer loads `ox`'s BLS module and `@noble/curves/bls12-381`, whose import-time precomputation slowed React Native startup.
