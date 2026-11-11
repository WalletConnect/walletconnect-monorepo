---
"@walletconnect/react-native-compat": patch
"@walletconnect/types": patch
"@walletconnect/utils": patch
"@walletconnect/core": patch
"@walletconnect/sign-client": patch
"@walletconnect/universal-provider": patch
"@walletconnect/ethereum-provider": patch
"@walletconnect/signer-connection": patch
---

Ship consumer ProGuard/R8 rules for JNA and the yttrium uniffi bindings so minified Android release builds (default in Expo SDK 58) no longer fail with `Missing class java.awt.Component`.
