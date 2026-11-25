# @walletconnect/core

Core for WalletConnect Protocol

## Lifetime

`core.dispose()` permanently closes that instance. It cancels pending connection attempts, removes network listeners, stops timers and drains admitted storage work. Construct a fresh instance to reopen persisted state. Ordinary `relayer.transportClose()` and `transportOpen()` retain their reconnect behavior.

A Core can be shared by multiple clients, including through global Core reuse. Its owner decides when to dispose it. When shutting down an exclusively owned client and Core, start both disposals before awaiting completion so pending protocol requests can be cancelled while local writes drain.

```ts
const clientClosing = client.dispose();
await Promise.all([clientClosing, core.dispose()]);
```

Keep the supplied storage available until both promises settle. Disposal preserves persisted sessions and keys for a future instance. Protocol messages already handed to the transport may have been delivered.

## License

WalletConnect Community License
