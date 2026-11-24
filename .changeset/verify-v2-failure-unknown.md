---
"@walletconnect/core": patch
---

When a v2 verify attestation is present but cannot be validated, resolve the verify result to unknown instead of falling back to the legacy attestation lookup for that request. Requests without an attestation are unaffected.
