---
"@walletconnect/utils": minor
"@walletconnect/sign-client": minor
---

Collect TVF transaction hashes for Stellar: compute the canonical transaction hash from signed `stellar_signXDR` envelopes (V0, V1 and fee-bump — with the signature-array scan hardened against signatures ending in zero bytes) and extract `tx_hash` from `stellar_signAndSubmitXDR` responses.
