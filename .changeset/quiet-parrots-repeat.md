---
"@walletconnect/sign-client": patch
"@walletconnect/utils": patch
---

Bind `wc_sessionAuthenticate` responses to the request that was sent.

A verified signature only proves that the address in `iss` signed the CACAO's own
payload. `validateSignedCacao` reconstructs the signed message from that same
payload and does not take the request as an argument, so it cannot tell an answer
to this request apart from a genuine CACAO the same wallet issued for a different
site — and no caller compared `domain`, `aud` or `nonce` either. A CACAO a user
signed for one site was therefore accepted by an unrelated dapp.

Authenticate responses are now checked against the originating request with the new
`isCacaoBoundToRequest` export from `@walletconnect/utils`, which compares `domain`,
`aud` and `nonce`, requires the chain in `iss` to have been requested, and enforces
`exp`/`nbf`. Fields that wallets legitimately rewrite are deliberately not compared:
`populateAuthPayload` appends the recap statement, rewrites `resources` and narrows
`chains`, so comparing those would reject every conformant wallet.
