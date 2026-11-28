---
"@walletconnect/sign-client": patch
---

fix: make `deleteSession` idempotent

Guard `deleteSession` against an already-removed session topic so a redundant session delete — peer `wc_sessionDelete`, expiry, or a concurrent disconnect/expiry race — is a safe no-op instead of throwing and logging `No matching key. session: <topic>` (see #2983, #1639).
