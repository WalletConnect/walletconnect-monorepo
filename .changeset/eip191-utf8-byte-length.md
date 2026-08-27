---
"@walletconnect/utils": patch
---

Fix `hashEthereumMessage` prefixing the JavaScript string length (UTF-16 code units) instead of the UTF-8 byte length required by EIP-191. Any SIWE/CACAO message containing a non-ASCII character (e.g. a localized or emoji statement, or a Unicode domain) hashed to a value that no compliant signer produces, so `eip191` and `eip1271` verification deterministically failed for every wallet type. Hashes of ASCII messages are unchanged; this restores the pre-2.18.0 behaviour (`ethers` `hashMessage`). Consumers calling `hashEthereumMessage` directly now receive the standard EIP-191 hash for non-ASCII input.
