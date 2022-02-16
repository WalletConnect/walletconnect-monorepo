### Deploy configs
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
TAG=$(shell git tag --points-at HEAD)
GITHASH=$(shell git rev-parse --short HEAD)
project=walletconnect
redisImage=redis:6-alpine
nixImage=nixos/nix:2.6.0
standAloneRedis=xredis

## Environment variables used by the compose files
export PROJECT=$(project)
export WAKU_IMAGE=$(shell cat ./build/build-img-waku-name)
export RELAY_IMAGE=$(shell cat ./build/build-img-relay-name)

### Makefile internal coordination
log_end=@echo "MAKE: Done with $@"; echo
flags=.makeFlags
VPATH=$(flags):build
$(shell mkdir -p $(flags))
.PHONY: help clean clean-all reset build

version=$(BRANCH)
ifneq (, $(TAG))
	version=$(TAG)
endif

dockerizedNix=docker run --name builder --rm -v nix-store:/nix -v $(shell pwd):/src -w /src nixos/nix nix-shell -p bash --run
dockerLoad=docker load -i build/$@ | awk '{print $$NF}' \
    | grep walletconnect > build/$@-name 
copyResult=cp -r -f -L result build/$@ && rm -rf result
buildRelay=nix-build --option sandbox false --attr relay --argstr tag $(version) --argstr githash $(GITHASH) && $(copyResult)
buildWaku=nix-build ./ops/waku-docker.nix && $(copyResult)

# Shamelessly stolen from https://www.freecodecamp.org/news/self-documenting-makefile
help: ## Show this help
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dirs:
	mkdir -p build
	mkdir -p $(flags)

pull: ## pulls docker images
	docker pull $(redisImage)
	touch $(flags)/$@
	$(log_end)

bootstrap-lerna: ## setups lerna for the monorepo management
	npm i --include=dev
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

dockerized-nix:
ifeq (, $(shell which nix))
	docker volume create nix-store
	docker pull $(nixImage)
	touch $(flags)/$@
	$(log_end)
endif

build-img-relay: dirs dockerized-nix ## builds relay docker image inside of docker
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildRelay)"
else
	$(buildRelay)
endif
	$(dockerLoad)
	$(log_end)

build-img-waku: dirs pull dockerized-nix ## builds waky docker image inside of docker
ifeq (, $(shell which nix))
	$(dockerizedNix) "$(buildWaku)"
else
	$(buildWaku)
endif
	$(dockerLoad)
	$(log_end)

build-images: build-img-relay build-img-waku

push-images: build-images
	docker push $(shell cat ./build/build-img-waku-name)

build: dirs build-images bootstrap-lerna build-relay build-react-app build-react-wallet ## builds all the packages and the containers for the relay
	$(log_end)

test-client: build-lerna ## runs "./packages/client" tests against the locally running relay. Make sure you run 'make dev' before.
	npm run test --prefix packages/client

test-staging: build-lerna ## tests client against staging.walletconnect.com
	TEST_RELAY_URL=wss://staging.walletconnect.com npm run test --prefix packages/client

test-production: build-lerna ## tests client against relay.walletconnect.com
	TEST_RELAY_URL=wss://relay.walletconnect.com npm run test --prefix packages/client

test-relay: build-relay ## runs "./servers/relay" tests against the locally running relay. Make sure you run 'make dev' before. Also needs waku nodes running locally
	npm run test --prefix servers/relay

start-redis: ## starts redis docker container for local development
	docker run --rm --name $(standAloneRedis) -d -p 6379:6379 $(redisImage) || true
	$(log_end)

predeploy: dirs pull build-images 
	touch $(flags)/$@

dev: predeploy ## runs relay on watch mode and shows logs
	docker stack deploy $(project) \
		-c ops/docker-compose.ci.yml
	$(log_end)

ci: ## runs tests in github actions
	$(MAKE) dev
	sleep 15
	docker service logs --tail 100 $(project)_relay
	TEST_RELAY_URL=ws://localhost:5000 $(MAKE) test-client
	TEST_RELAY_URL=ws://localhost:5000 $(MAKE) test-relay

deploy-no-monitoring: setup predeploy ## same as deploy but without the monitoring
	MONITORING=false bash ops/deploy.sh
	$(log_end)

redeploy: setup clean predeploy ## redeploys the prodution containers and rebuilds them
	docker service update --force --image $(relayImage) $(project)_relay

relay-logs: ## follows the relay container logs.
	docker service logs -f --raw --tail 100 $(project)_relay

cachix: clean dirs ## pushes docker images to cachix
	cachix push walletconnect $(shell $(buildRelay))
	cachix push walletconnect $(shell $(buildWaku))

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
	rm -rf .makeFlags build result*
	$(log_end)
