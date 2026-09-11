---
"@walletconnect/sign-client": patch
---

Abort authenticated session settlement when a CACAO fails signature verification.

On the dapp side, a `wc_sessionAuthenticate` response whose CACAO failed verification
rejected the caller's promise but did not stop the handler, so a session was still
derived, subscribed and persisted from the unverified payload — leaving a session in
`client.session` for an account nobody proved control of, even though the application
had been told that verification failed.

Applications that relied on a session appearing despite a rejected `authenticate()`
promise will no longer receive one.
