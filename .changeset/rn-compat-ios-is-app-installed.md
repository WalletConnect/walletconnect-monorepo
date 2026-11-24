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

Harden `isAppInstalled` on iOS: resolve `false` for `nil`, empty or malformed input instead of querying `(null)://`, accept `scheme`, `scheme://` and full URLs, never reject, and call `canOpenURL` on the main queue. Add `getInstalledApps(identifiers)` (URL schemes on iOS, package names on Android) to check many apps in one native call; it is exposed on `global.Application` when the WalletConnect native module is used.
