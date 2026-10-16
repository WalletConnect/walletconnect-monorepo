# @walletconnect/sign-client

Sign Client for WalletConnect Protocol

## Description

This library provides a Sign Client for WalletConnect v2.0 Protocol for both Dapps and Wallets. Integration will differ from the perspective of each client as the Proposer and Responder, respectively. It's compatible with NodeJS, Browser and React-Native applications (NodeJS modules required to be polyfilled for React-Native)

## Sign v3 (experimental)

`@walletconnect/sign-client/v3` keeps v2's SignClient API and speaks the Sign v3 protocol underneath. The engine is the Sign v3 Rust SDK compiled to WASM and embedded in the package, so it adds nothing to the main entry.

```ts
// v2, unchanged
import { SignClient } from "@walletconnect/sign-client";

// the v3 protocol, the same API
import { SignClient } from "@walletconnect/sign-client/v3";

const client = await SignClient.init({ projectId, metadata });
const { uri, approval } = await client.connect({ optionalNamespaces });
```

- **What it covers:**
  - **Methods:** `connect` and `approval()`, `pair`, `approve`, `reject`, `request`, `respond`, `emit`, `ping`, `update`, `extend`, `disconnect`, `session.getAll()`.
  - **Events:** `session_proposal`, `session_connect`, `session_request`, `session_event`, `session_update`, `session_extend`, `session_ping`, `session_delete`, `session_expire`.
- **Where v3 differs:**
  - The pairing topic is the connection id, which is also the session topic.
  - Public keys are empty.
  - `verifyContext` is `UNKNOWN`.
  - A session doesn't keep the proposal's required and optional namespaces.
  - Auth (`authenticate`) and pairing management aren't available.
- **Relay.** `relayUrl` defaults to the dev Relay that speaks v3, `https://pool-1.dev-relay.walletconnect.com`.
- **Platforms.** Browsers and Node 20+. React Native is not supported.
- **Updating the engine.** `scripts/sync-v3-wasm.sh` rebuilds the WASM from yttrium `crates/sign-v3` and embeds it in `src/v3/wasm`. `SIGN_V3_WASM_SOURCE` reports the build it came from.
- **Tests.** `npx vitest run test/v3` runs them against a live v3 Relay. They aren't part of `npm run test`.
