---
"@walletconnect/core": minor
"@walletconnect/sign-client": minor
"@walletconnect/types": minor
"@walletconnect/utils": minor
---

Add explicit terminal disposal for Core and SignClient, including owned request cancellation, listener and timer cleanup, and draining admitted storage mutations. SignClient disposal preserves a separately owned shared Core.
