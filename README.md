# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup development

The following dependencies are required for relay server:

- git
- make
- docker version 20.10

To setup the local redis and relay server you can run:

```sh
make dev
```

## Test Client

Client unit tests can be run against: local (`make dev`), staging, and production server

```sh
# local (dev)
make test-client

# staging server
make test-staging

# production server
make test-production
```

## Additional help

```
bootstrap-lerna      setups lerna for the monorepo management
build                builds all packages
build-img-relay      builds relay docker image
build-img-waku       builds waku docker image
build-lerna          builds the npm packages in "./packages"
build-react-app      builds the example react-app
build-react-wallet   builds the example react-wallet
build-relay          builds the relay using system npm
cachix               pushes docker images to cachix
ci                   runs ci tests
clean                removes all build outputs
dev                  runs relay on watch mode and shows logs
dockerized-nix       setups the volume and docker image for nix commands
down                 alias of stop
help                 Show this help
pull                 pulls needed docker images
relay-logs           follows the relay container logs.
rm-redis             stops the redis container
start-redis          starts redis docker container for local development
stop-redis           alias to rm-redis
stop                 stops the whole docker stack
test-client          runs "./packages/client" tests against the locally running relay. Make sure you run 'make dev' before.
test-production      tests client against relay.walletconnect.com
test-relay           runs "./servers/relay" tests against the locally running relay. Make sure you run 'make dev' before.
test-staging         tests client against staging.walletconnect.com
```

## License

Apache 2.0
