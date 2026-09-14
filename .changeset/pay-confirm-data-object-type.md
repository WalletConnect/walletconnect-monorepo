---
"@walletconnect/pay": patch
---

Relax `ConfirmPaymentParams.data` element type from `Record<string, unknown>` to `object`, so wallet RPC results declared as TypeScript interfaces (e.g. a TRON `{ raw_data_hex, signature }` result type) are accepted without a cast. No runtime change.
