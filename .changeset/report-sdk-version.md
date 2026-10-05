---
"@walletconnect/types": minor
"@walletconnect/core": minor
---

`eventClient.init()` now accepts an optional `{ sdk: { name, version } }` so SDKs built on top of core (e.g. WalletKit) can report their own version. When provided, it's sent as `sdk_name`/`sdk_version` properties on the events `INIT` event, alongside the existing core `user_agent`.
