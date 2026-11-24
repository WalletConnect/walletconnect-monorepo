---
"@walletconnect/sign-client": major
"@walletconnect/types": major
"@walletconnect/core": minor
---

**Breaking: Verify v4.** Wallets get one `verification` object instead of the historical `verifyContext`, and no longer see a dApp's self-asserted identity.

- **`verifyContext` is replaced by `verification: Verify.AppVerification`** on `session_proposal`, `session_request`, `session_authenticate`, pending session requests and pending authenticate requests:
  - `{ domain?, name?, icon?, isVerified, isScam, isSimilarTo? }`. There is no `validation` (`VALID` / `INVALID` / `UNKNOWN`) and no state: show whatever is present.
  - **Sign v3:** every field comes from the Relay's `appMetadata`, once the SDK checked the app's signature is for that message. An unsigned request gives `{ isVerified: false, isScam }`.
  - **Sign v2:** `{ isVerified: false, isScam }`, with `isScam` from the legacy attestation, which never gives a domain, name or icon. When the Relay delivers `appMetadata` on Sign v2 (`message_v2.received` or `irn_subscription` data), the same rules as Sign v3 apply to it, mismatch included.
  - The app's JWT is read from `appMetadata.appSignature`. It isn't exposed in `verification`.
- **A mismatched App Signature is not shown at all (Sign v3).**
  - A message whose signature is for another message is dropped. A request is answered with the JSON-RPC error `{ code: -32600, message: "app_signature_mismatch" }`. The new `app_signature_mismatch` event fires with `{ topic, id?, method? }`.
  - A mismatched proposal makes `pair()` reject with `app_signature_mismatch`.
- **Wallets no longer see a dApp's `name`, `url` or `icons`.**
  - `session_proposal`'s `params` is a `ProposalTypes.WalletStruct`, whose `proposer.metadata` is `SignClientTypes.PeerMetadata`: `{ description, redirect?, verifyUrl? }`.
  - A wallet's stored proposals, sessions (`peer.metadata`), authenticate requests and pairings keep those fields empty. `SessionTypes.PeerMetadata` marks them `@deprecated` for wallets, pending a split of the session type.
  - A wallet's session carries `verification`.
  - The dApp still sends its metadata, and dApps still see the wallet's.
- **dApps can sign their messages:** `SignClient.init({ appSignature: { callback } })`.
  - The callback gets `{ request, requestJson, ciphertextHash }` and returns `{ appSignature }`.
  - **Sign v3:** it signs the proposal and every message.
  - **Sign v2:** it signs session proposals (including the fallback offer), session requests and authenticate requests. The SDK encrypts first and passes `ciphertextHash`, base64url SHA-256 of the envelope bytes as published, so the JWT carries a `cth` the Relay checks before it mints a legacy attestation. The JWT is sent as the `appSignature` param of `irn_publish` / `wc_proposeSession`, or the `appSignature` field over HTTP. With a callback, the old Verify attestation (verify-server iframe and `attestation` param) is no longer fetched.
  - If the callback throws, the call fails with `app_signature_failed`, and nothing is sent unsigned.
- `RelayerTypes.PublishOptions` gains `appSignature`.
