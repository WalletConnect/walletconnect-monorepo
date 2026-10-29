---
"@walletconnect/utils": patch
---

Use `@noble/hashes`' `blake2b` for the Polkadot extrinsic hash instead of `blakejs`, dropping the `blakejs` dependency. The hash output is unchanged.
