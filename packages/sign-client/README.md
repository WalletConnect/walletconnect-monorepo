# @walletconnect/sign-client

Sign Client for WalletConnect Protocol

## Description

This library provides a Sign Client for WalletConnect v2.0 Protocol for both Dapps and Wallets. Integration will differ from the perspective of each client as the Proposer and Responder, respectively. It's compatible with NodeJS, Browser and React-Native applications (NodeJS modules required to be polyfilled for React-Native)

## Documentation

Check out documentation [here](https://docs.walletconnect.com/).

Also available quick start for [Dapps](https://docs.reown.com/api/sign/dapp-usage) and for [Wallets](https://docs.reown.com/api/sign/wallet-usage)

## Lifetime

`client.dispose()` immediately rejects new client operations, cancels pending client awaits, detaches its listeners and drains admitted local mutations. The shared Core remains running. A delayed protocol response cannot resume the disposed client's session or approval flow.

The Core owner must separately call `core.dispose()` when all clients are finished. For an exclusively owned pair, start client and Core disposal together and retain storage until both settle.

```ts
await Promise.all([client.dispose(), core.dispose()]);
```

Stored sessions remain available to a newly initialized client. Disposal cannot recall a protocol message already handed to the transport.

## License

WalletConnect Community License
