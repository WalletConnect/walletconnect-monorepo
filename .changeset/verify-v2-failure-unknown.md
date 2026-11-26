---
"@walletconnect/core": patch
---

When a v2 verify attestation is present but cannot be validated, the verify result for that request resolves to unknown. Requests without an attestation are unaffected.
