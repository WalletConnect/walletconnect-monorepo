### Deploy configs
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
GITHASH=$(shell git rev-parse --short HEAD)
REMOTE=$(shell git remote show origin -n | grep Push | cut -f6 -d' ')
REMOTE_HASH=$(shell git ls-remote $(REMOTE) $(BRANCH) | head -n1 | cut -f1)
project=walletconnect
redisImage=redis:6-alpine
standAloneRedis=xredis

## Environment variables used by the compose files
export PROJECT=$(project)
export $(shell sed 's/=.*//' setup)

### Makefile internal coordination
log_end=@echo "MAKE: Done with $@"; echo
flags=.makeFlags
VPATH=$(flags):build
$(shell mkdir -p $(flags))
.PHONY: help clean clean-all reset build

dockerizedNix=docker run --name builder --rm -v nix-store:/nix -v $(shell pwd):/src -w /src nixos/nix nix-shell -p bash --run
dockerLoad=docker load -i build/$@ \
		| awk '{print $$NF}' \
		| tee build/$@-img
copyResult=cp -r -f -L result build/$@ && rm -rf result
buildRelayDeps=nix-build --attr relayDeps
buildRelayApp=nix-build --attr relayApp
buildRelay=nix-build --attr relay --argstr githash $(GITHASH) && $(copyResult)
caddyVersion=v2.4.3
caddySrc=https://github.com/WalletConnect-Labs/nix-caddy/archive/$(caddyVersion).tar.gz
buildCaddy=nix-build $(caddySrc) --attr docker && $(copyResult)
WAKU_VERSION_TAG ?= v0.5.1
WAKU_SHA256 ?= 0k55hw1wqcyrpf9cxchhxdb92p75mmskkpvfn1paivl1r38pyb4a
buildWakuCommand:=nix-build ./ops/waku-docker.nix --argstr wakuVersionTag $(WAKU_VERSION_TAG) --argstr nixNimRepoSha256 $(WAKU_SHA256)

buildWaku=$(buildWakuCommand) && $(copyResult)
# Shamelessly stolen from https://www.freecodecamp.org/news/self-documenting-makefile
help: ## Show this help
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dirs:
	mkdir -p build
	mkdir -p $(flags)

pull: ## pulls docker images
	docker pull $(redisImage)
ifeq (, $(shell which nix))
	docker pull nixos/nix
endif
	touch $(flags)/$@
	$(log_end)

setup: ## configures domain and certbot email
	@read -p 'Relay URL domain [localhost]: ' relay; \
	echo "export RELAY_URL="$${relay:-localhost} > setup
	@read -p 'Email for SSL certificate (default noreply@gmail.com): ' email; \
	echo "export CERTBOT_EMAIL="$${email:-noreply@gmail.com} >> setup
	@read -p 'Paste your cloudflare API token: ' cf; \
	echo "export CLOUDFLARE_TOKEN="$${cf} >> setup
	$(log_end)

bootstrap-lerna: ## setups lerna for the monorepo management
	npm i --dev
	npm run bootstrap
	touch $(flags)/$@
	$(log_end)

build-react-app: ## builds the example react-app
	npm install --prefix examples/react-app
	npm run build --prefix examples/react-app
	touch $(flags)/$@
	$(log_end)

build-react-wallet: ## builds the example react-wallet
	npm install --prefix examples/react-wallet
	npm run build --prefix examples/react-wallet
	touch $(flags)/$@
	$(log_end)

build-lerna: bootstrap-lerna ## builds the npm packages in "./packages"
	npm run build
	touch $(flags)/$@
	$(log_end)

build-relay: ## builds the relay using system npm
	npm install --also=dev --prefix servers/relay
	npm run build --prefix servers/relay
	$(log_end)

nix-volume:
ifneq (, $(shell which nix))
	docker volume create nix-store
endif
	$(log_end)

build-relay-deps: dirs
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildRelayDeps)"
else
	$(buildRelayDeps)
endif
	$(log_end)

build-relay-app: dirs
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildRelayApp)"
else
	$(buildRelayApp)
endif
	$(log_end)

build-img-relay: dirs nix-volume build-relay-deps build-relay-app ## builds relay docker image inside of docker
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildRelay)"
else
	$(buildRelay)
endif
	$(dockerLoad)
	$(log_end)

build-img-caddy: dirs nix-volume ## builds caddy docker image inside of docker
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildCaddy)"
else
	$(buildCaddy)
endif
	$(dockerLoad)
	$(log_end)

build-img-waku: dirs nix-volume ## builds caddy docker image inside of docker
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildWaku)"
else
	$(buildWaku)
endif
	$(dockerLoad)
	$(log_end)

build-images: build-img-relay build-img-caddy build-img-waku

build: dirs build-images bootstrap-lerna build-relay build-react-app build-react-wallet ## builds all the packages and the containers for the relay
	$(log_end)

test-client: build-lerna ## runs "./packages/client" tests against the locally running relay. Make sure you run 'make dev' before.
	npm run test --prefix packages/client

test-staging: build-lerna ## tests client against staging.walletconnect.org
	TEST_RELAY_URL=wss://staging.walletconnect.org npm run test --prefix packages/client

test-production: build-lerna ## tests client against relay.walletconnect.org
	TEST_RELAY_URL=wss://relay.walletconnect.org npm run test --prefix packages/client

test-relay: build-relay ## runs "./servers/relay" tests against the locally running relay. Make sure you run 'make dev' before. Also needs waku nodes running locally
	npm run test --prefix servers/relay

start-redis: ## starts redis docker container for local development
	docker run --rm --name $(standAloneRedis) -d -p 6379:6379 $(redisImage) || true
	$(log_end)

predeploy: dirs pull build-images 
	touch $(flags)/$@

dev: predeploy ## runs relay on watch mode and shows logs
	RELAY_MODE=any REPLICAS=1 MONITORING=false NODE_ENV=development $(MAKE) deploy
	@echo  "MAKE: Done with $@"
	@echo
	$(log_end)

ci: ## runs tests in github actions
	printf "export RELAY_URL=localhost\nexport CERTBOT_EMAIL=norepy@gmail.com\nexport CLOUDFLARE_TOKEN=\n" > setup
	$(MAKE) dev
	nix show-derivation /nix/store/*-relay-conf.json.drv
	nix show-derivation /nix/store/*-stream-relay.drv
	nix show-derivation /nix/store/*-relay.tar.gz.drv
	nix show-derivation /nix/store/*-relay-base.json.drv
	sleep 15
	docker service logs --tail 100 $(project)_caddy
	docker service logs --tail 100 $(project)_relay
	TEST_RELAY_URL=wss://localhost $(MAKE) test-client
	TEST_RELAY_URL=wss://localhost $(MAKE) test-relay

deploy: setup predeploy ## Deploys the docker swarm for the relay
	bash ops/deploy.sh
	$(log_end)

deploy-no-monitoring: setup predeploy ## same as deploy but without the monitoring
	MONITORING=false bash ops/deploy.sh
	$(log_end)

redeploy: setup clean predeploy ## redeploys the prodution containers and rebuilds them
	docker service update --force --image $(caddyImage) $(project)_caddy
	docker service update --force --image $(relayImage) $(project)_relay

relay-logs: ## follows the relay container logs.
	docker service logs -f --raw --tail 100 $(project)_relay

cachix: clean dirs ## pushes docker images to cachix
	cachix push walletconnect $(shell $(buildRelayDeps))
	cachix push walletconnect $(shell $(buildRelayApp))
	cachix push walletconnect $(shell $(buildRelay))
	cachix push walletconnect $(shell $(buildWaku))
	cachix push walletconnect $(shell $(buildCaddy))

rm-redis: ## stops the redis container
	docker stop $(standAloneRedis) || true

down: stop ## alias of stop

stop: rm-redis ## stops the whole docker stack
	docker stack rm $(project)
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo
	$(log_end)

reset: ## removes all build artifacts
	rm -f setup
	rm -rf build
	$(log_end)

clean: ## removes all build outputs
	rm -rf .makeFlags build
	$(log_end)
