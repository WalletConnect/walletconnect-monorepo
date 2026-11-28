---
"@walletconnect/sign-client": patch
---

Report TVF tx hashes only for methods in `TVF_METHODS`. A string result of any other method, such as a `personal_sign` or `eth_signTypedData_v4` signature, was published to the relay as a tx hash, outside the encrypted payload.
