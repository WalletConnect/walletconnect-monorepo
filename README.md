# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup development


#### Relay Server

Clone the [Relay Server](https://github.com/WalletConnect/relay)

To setup the local redis and relay server you can run:

```sh
make dev
```

## Test Client

Client unit tests can be run against: local (`make dev`), staging, and production server

```sh
npm run test --prefix=packages/sign-client
```

## License

Apache 2.0
