---
"@walletconnect/universal-provider": minor
"@walletconnect/sign-client": minor
"@walletconnect/core": minor
"@walletconnect/types": minor
---

Universal Provider sends the `CONNECT_INITIATED`, `CONNECT_SUCCESS` and `SIGN_SUCCESS` funnel events to Pulse with `st=universal-provider`, tagged with `connectionOrigin` (`"wallet"` or `"dapp"`) and, for wallet-originated sessions, `walletGuideId`. Opt out with `telemetryEnabled: false`. Core's events client gets `sendFunnelEvent()`, which sends one event in its own request with the caller's sdk type; core's own events keep `st=events_sdk`. Sign Client emits a local `session_request_success` event when the wallet approves a `request()`.
