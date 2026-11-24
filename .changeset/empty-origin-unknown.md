---
"@walletconnect/sign-client": patch
---

Leave `verified.origin` empty when the verify context validation is `UNKNOWN`, instead of echoing the peer-supplied metadata url. This aligns the verify context with the Swift and Kotlin SDKs.
