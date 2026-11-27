---
"@walletconnect/universal-provider": minor
---

Add support for host-originated launches. When a host, such as a wallet's in-app browser, opens the app and injects `window.walletConnectHost` with `autoConnect: true` and a `postMessage` function, `connect()` sends the pairing URI to the host as a `wc_session_offer` message instead of emitting `display_uri`, so no QR code or modal opens. `UniversalProvider.isHostLaunch()` (also available as the `isHostLaunch` instance getter) tells callers whether to call `connect()` on page load. Universal Provider still never connects on its own, and behaviour is unchanged when the bridge isn't present.
