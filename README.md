# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.org

## Setup Server

The following dependencies are required for relay server:

- git
- make
- docker

Then you need to enable the docker swarm:

```sh
docker swarm init
```

Finally you can setup the containers:

```sh
make dev
```

## Test Client

Client unit tests can be run against: local (dev), staging and production server

```sh
# local (dev)
make test-client

# staging server
make test-staging

# production server
make test-production
```

## License

LGPL-3.0
