---
"@walletconnect/sign-client": patch
---

Link mode verify context now resolves to `UNKNOWN`. Link mode traffic is not attested by the Verify server, so link mode requests report `UNKNOWN` validation.
