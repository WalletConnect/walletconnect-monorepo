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
  - A session doesn't keep the proposal's required and optional namespaces.
- **Verify v4 (experimental).**
  - **What wallets see:** `verification`, a `Verify.AppVerification` `{ domain?, registrableDomain?, name?, icon?, isVerified, isScam, isSimilarTo? }`, on `session_proposal`, `session_request`, `session_authenticate` and a wallet's session. Show whatever is present.
    - `domain` is always ASCII: an internationalised name comes as punycode (`app.xn--uniswp-7nf.org`), never Unicode. `registrableDomain` is its eTLD+1 per the Public Suffix List, private suffixes included (`uniswap.org`, `alice.github.io`), absent for an IP address or a bare suffix.
    - **Display rule:** show the ASCII `domain`, never a Unicode rendering; never truncate `registrableDomain`, and emphasise it within `domain`. Truncate only the labels to its left, if anything.
    - **Sign v3:** every field comes from the Relay's `appMetadata`, once the SDK checked that the app's signature is for that message.
    - **Sign v2, or unsigned:** `{ isVerified: false, isScam }`, with `isScam` from the legacy attestation. If the Relay adds `appMetadata` to a Sign v2 delivery, the Sign v3 rules apply to it.
    - The app's JWT comes in `appMetadata.appSignature`. It isn't exposed in `verification`.
  - **No self-asserted identity:** wallets never see the app's own `name`, `url` or `icons`.
    - A proposal's `proposer.metadata` is `{ description, redirect?, verifyUrl? }`.
    - A wallet's stored proposals, sessions and pairings keep those fields empty. `SessionTypes.PeerMetadata` marks them `@deprecated`: wallets must use `verification`.
  - **A mismatch drops the message (Sign v3, and Sign v2 with `appMetadata`):** a message whose App Signature is for another message never reaches the wallet.
    - A request is answered with the JSON-RPC error `{ code: -32600, message: "app_signature_mismatch" }`, and `app_signature_mismatch` fires with `{ topic, id?, method? }`.
    - A mismatched proposal makes `pair()` reject with `app_signature_mismatch`.
  - **A session stays signed (wallets):** signing the proposal is optional. A session is pinned to the first domain that signs on it: the proposal's (or authenticate request's) `iss` if it was signed, else the first accepted signed request's. The pin is kept with the session (`appDomain`), so it survives restarts.
    - Before it's pinned, an unsigned request is shown, unverified.
    - Once pinned, an unsigned request is dropped and never shown: `app_signature_required` fires with `{ topic, id?, method?, domain }`, and it's answered with `{ code: -32600, message: "app_signature_required" }`. One signed by another domain is dropped the same way, with `app_signature_domain_changed` and `{ topic, id?, method?, domain, signedBy }`.
    - **Sign v2:** only `wc_sessionRequest` is checked, the one signed request on a session; link mode requests, which skip the Relay and carry no signature, are let through. **Sign v3:** every request from the app.
  - **Apps sign:** pass `appSignature: { callback }` to `SignClient.init`. The callback gets `{ request, requestJson }` and returns `{ appSignature }`, an ES256 JWT from the app's backend: `iss` the app's host, `sub` and `exp`. No claim covers the encrypted bytes, which the backend can't check; wallets ignore a `cth` if an older backend still signs one.
    - **`sub`** is base64url (no padding) SHA-256 of `requestJson`'s UTF-8 bytes, the plaintext exactly as sent. Hash `requestJson`, not a re-serialized `request`.
    - **Sign v3:** the client calls it before creating a connection and before every message. It also gets `cnx`, to copy verbatim into the JWT's `cnx` claim: a message's connectionId (a decimal string), or for the proposal, signed before any connectionId exists, the request's `bindingPub` (base64url, no padding). The Relay refuses a Sign v3 signature whose `cnx` is missing or names another connection.
    - **Sign v2:** it calls it for session proposals (including the fallback offer), session requests and authenticate requests. `sub` covers the plaintext, never the envelope, so the backend signs only what it has seen. The Relay mints no legacy attestation: old wallets get `attestation: ""` and show `UNKNOWN`. The JWT goes out as the `appSignature` param of `irn_publish` / `wc_proposeSession` (or the HTTP body's `appSignature`), and the old Verify attestation isn't fetched. `requestJson` is `safeJsonStringify(payload)`, which `crypto.encode` encrypts, and which a wallet's `JSON.stringify(decoded)` recomputes unless the payload holds BigInts.
    - **If it throws:** the call fails with `app_signature_failed`, and nothing is sent unsigned; `connect()` doesn't fall back to the other protocol.
    - **Retries:** a send retried after its JWT's `exp` (less 10 s) calls the callback again, for the same request, and sends the new JWT; an expired JWT is never resent. If it can't sign, the send fails for good. Wallets never check `exp`: a request's expiry is its own `expiryTimestamp` / deadline.
- **v2 only.** `authenticate` and its approve and reject calls, `find`, `getPendingSessionRequests`, `proposal` and `pendingRequest` cover v2 alone. `core.pairing.pair()` doesn't route: it treats every URI as v2.
- **Relay.** Both protocols use the client's `relayUrl`, which has to speak v3 and v2 over HTTP. Today that is the dev Relay, `https://pool-1.dev-relay.walletconnect.com`.
- **Platforms.** Browsers and Node 20+. React Native is not supported.
- **Updating the engine.** `scripts/sync-v3-wasm.sh` rebuilds the WASM from yttrium `crates/sign-v3` and embeds it in `src/v3/wasm`. `SIGN_V3_WASM_SOURCE` reports the build it came from.
- **Tests.** `npx vitest run test/v3` runs them against a live v3 Relay. They aren't part of `npm run test`.
