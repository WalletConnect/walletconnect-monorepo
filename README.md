# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.org

## Setup

1. Bootstrap monorepo with all dependencies

```sh
make bootstrap
```

2. Build packages and development environment

```sh
make build
```

## Test

In parallel, run both the relay server and the client tests in two different terminals, respectively

```sh
## Relay Server
make relay-start

## Client Test
make test-client
```

## License

LGPL-3.0
