---
"@walletconnect/utils": patch
---

Fix `isValidEip1271Signature` treating any message that starts with `0x` as an already-hashed digest. A plaintext SIWE/CACAO message whose domain begins with `0x` (e.g. `0xsplits.xyz`) was spliced unhashed into the `eth_call` calldata, so EIP-1271 verification for smart-contract wallets deterministically failed against such dApps. Only a 32-byte hex string is now treated as pre-hashed; everything else is hashed per EIP-191.
