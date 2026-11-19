# @walletconnect/sign-client

Sign Client for WalletConnect Protocol

## Description

This library provides a Sign Client for WalletConnect v2.0 Protocol for both Dapps and Wallets. Integration will differ from the perspective of each client as the Proposer and Responder, respectively. It's compatible with NodeJS, Browser and React-Native applications (NodeJS modules required to be polyfilled for React-Native)

## Sign v3 (experimental)

`SignClient` speaks Sign v2 and Sign v3 behind the one API. A connection uses v3 when both sides speak it, and v2 otherwise. The v3 engine is the Sign v3 Rust SDK compiled to WASM and embedded in the package.

- **How a connection picks its protocol:**
  - **The URI** is a valid v2 pairing URI with one more parameter, `v3`, that holds the v3 connection id: `wc:<sha256(symKey)>@2?relay-protocol=irn&symKey=…&expiryTimestamp=…&v3=<connectionId>`. Both protocols use the one `symKey`.
  - **`connect()`** offers both: it creates the v3 connection request and publishes a v2 session proposal on the pairing topic. The first answer settles `approval()` and the other offer is dropped. With `pairingTopic`, `authentication` or `walletPay`, which v3 doesn't carry, it offers v2 only.
  - **`pair()`** uses v3 when the URI has the `v3` parameter, and v2 otherwise.
  - **Every other call** goes to the engine that owns the session or proposal.
- **Without v3.** The client speaks v2 only where there is no WebAssembly, as on React Native, and when the v3 engine fails to start.
- **What a v3 connection covers:**
  - **Methods:** `connect` and `approval()`, `pair`, `approve`, `reject`, `request`, `respond`, `emit`, `ping`, `update`, `extend`, `disconnect`, and reads on `session`.
  - **Events:** `session_proposal`, `session_connect`, `session_request`, `session_event`, `session_update`, `session_extend`, `session_ping`, `session_delete`, `session_expire`.
- **Where a v3 session differs from a v2 one:**
  - The pairing topic is the connection id, which is also the session topic.
  - Public keys are empty.
  - `verifyContext` is `UNKNOWN`.
  - A session doesn't keep the proposal's required and optional namespaces.
- **v2 only.** `authenticate` and its approve and reject calls, `find`, `getPendingSessionRequests`, `proposal` and `pendingRequest` cover v2 alone. `core.pairing.pair()` doesn't route: it treats every URI as v2.
- **Relay.** Both protocols use the client's `relayUrl`, which has to speak v3 and v2 over HTTP. Today that is the dev Relay, `https://pool-1.dev-relay.walletconnect.com`.
- **Platforms.** Browsers and Node 20+. React Native is not supported.
- **Updating the engine.** `scripts/sync-v3-wasm.sh` rebuilds the WASM from yttrium `crates/sign-v3` and embeds it in `src/v3/wasm`. `SIGN_V3_WASM_SOURCE` reports the build it came from.
- **Tests.** `npx vitest run test/v3` runs them against a live v3 Relay. They aren't part of `npm run test`.
