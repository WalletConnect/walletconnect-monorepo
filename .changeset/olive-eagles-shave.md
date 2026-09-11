---
"@walletconnect/sign-client": minor
"@walletconnect/utils": minor
"@walletconnect/types": minor
---

Fail closed when CACAO signature verification throws, and stop those throws escaping
the authenticate response handler.

`verifySignature` throws rather than returning `false` on several attacker-controlled
inputs: an unknown `s.t` hits its `default:` branch, a malformed eip191 signature
throws out of `Signature.fromHex`/`recoverAddress`, and a non-CAIP-2 chain in `iss`
throws before the eip1271 request is made. `validateSignedCacao` guarded only
`formatMessage`, so those propagated to callers.

On the dapp side that escaped `onAuthenticate`, an async event listener whose rejection
nothing observed, so `authenticate()` stayed pending until the one hour request expiry
instead of rejecting — and under node's default unhandled-rejection handling the
process exited. `validateSignedCacao` now fails closed, keeping its documented boolean
contract, and the authenticate response handler routes any remaining failure to the
same rejection path.

Also models `uri` on `AuthTypes.CacaoPayload`, since `formatMessage` signs `aud || uri`
and a wallet may send either.
