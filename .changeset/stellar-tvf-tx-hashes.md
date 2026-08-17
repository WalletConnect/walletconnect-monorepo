---
"@walletconnect/utils": patch
"@walletconnect/sign-client": patch
---

Add TVF transaction hash collection for Stellar (`stellar_signXDR`, `stellar_signAndSubmitXDR`). For `stellar_signXDR` the hash is computed dependency-free from the signed TransactionEnvelope XDR as `sha256(network_id || envelope_type || transaction_body)`, supporting V0, V1 and fee-bump envelopes.
