### Deploy configs
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
GITHASH=$(shell git rev-parse --short HEAD)
REMOTE=$(shell git remote show origin -n | grep Push | cut -f6 -d' ')
REMOTE_HASH=$(shell git ls-remote $(REMOTE) $(BRANCH) | head -n1 | cut -f1)
project=walletconnect
redisImage=redis:6-alpine
standAloneRedis=xredis
caddyImage=$(project)/caddy:$(BRANCH)
relayImage=$(project)/relay:$(BRANCH)
wakuImage=$(project)/waku:walletconnect

## Environment variables used by the compose files
include setup
export $(shell sed 's/=.*//' setup)
export PROJECT = $(project)
export RELAY_IMAGE=$(relayImage)
export CADDY_IMAGE=$(caddyImage)
export WAKU_IMAGE=$(wakuImage)

### Makefile internal coordination
log_end=@echo "MAKE: Done with $@"; echo
flags=.makeFlags
VPATH=$(flags):build
$(shell mkdir -p $(flags))
.PHONY: help clean clean-all reset

# Shamelessly stolen from https://www.freecodecamp.org/news/self-documenting-makefile
help: ## Show this help
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dirs:
	mkdir -p build
	mkdir -p $(flags)

pull: ## pulls docker images
	docker pull $(redisImage)
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

setup: ## configures domain and certbot email
	@read -p 'Relay URL domain: ' relay; \
	echo "export RELAY_URL="$$relay > setup
	@read -p 'Email for SSL certificate (default noreply@gmail.com): ' email; \
	echo "export CERTBOT_EMAIL="$$email >> setup
	@read -p 'Paste your cloudflare API token: ' cf; \
	echo "export CLOUDFLARE_TOKEN="$${cf} >> setup
	@echo ${RELAY_URL}
	@touch $(flags)/$@
	$(log_end)

bootstrap-lerna: ## setups lerna for the monorepo management
	npm i
	npx lerna link
	npx lerna bootstrap
	@touch $(flags)/$@
	$(log_end)

build-react-app: ## builds the example react-app
	npm install --prefix examples/react-app
	npm run build --prefix examples/react-app
	@touch $(flags)/$@
	$(log_end)

build-react-wallet: ## builds the example react-wallet
	npm install --prefix examples/react-wallet
	npm run build --prefix examples/react-wallet
	@touch $(flags)/$@
	$(log_end)

build-lerna: bootstrap-lerna ## builds the npm packages in "./packages"
	npx lerna run build
	@touch $(flags)/$@
	$(log_end)

build-relay: ## builds the relay using system npm
	npm install --prefix servers/relay
	npm run build --prefix servers/relay
	$(log_end)

nix-volume:
	docker volume create nix-store
	$(log_end)

build-docker-relay-dockerized: nix-volume ## builds relay docker image inside of docker
	mkdir -p build
	docker run --name builder --rm \
		-v nix-store:/nix \
		-v $(shell pwd):/src \
		-w /src \
		nixos/nix nix-shell \
		-p bash \
		--run "nix-build \
			--attr docker \
			&& cp -L result /src/build/$@"
	docker load -i build/$@ \
		| awk '{print $$NF}' \
		| tee build/$@-img \
		| xargs -I {} docker tag {} $(relayImage)
	$(log_end)

build-docker-caddy-dockerized: nix-volume ## builds caddy docker image inside of docker
	mkdir -p build
	docker run --name builder --rm \
		-v nix-store:/nix \
		-v $(shell pwd):/src \
		-w /src \
		nixos/nix nix-shell \
		-p bash \
		--run "nix-build \
			https://github.com/sbc64/nix-caddy/archive/master.tar.gz \
			--attr docker \
			&& cp -L result /src/build/$@"
	docker load -i build/$@ \
		| awk '{print $$NF}' \
		| tee build/$@-img \
		| xargs -I {} docker tag {} $(caddyImage)
	$(log_end)

build-docker-relay: ## builds the relay docker image with nix
	nix-build \
		-o build/$@ \
		--attr docker \
		--argstr githash $(GITHASH)
	docker load -i build/$@ \
		| awk '{print $$NF}' \
		| tee build/$@-img \
		| xargs -I {} docker tag {} $(relayImage)
	$(log_end)

build-docker-caddy: ## ## builds the caddy docker image with nix
	nix-build \
		https://github.com/sbc64/nix-caddy/archive/master.tar.gz \
		-o build/$@ \
		--attr docker
	docker load -i build/$@ \
		| awk '{print $$NF}' \
		| tee build/$@-img \
		| xargs -I {} docker tag {} $(caddyImage)
	$(log_end)

build-containers: build-docker-relay-dockerized build-docker-caddy-dockerized
build-containers: build-docker-relay build-docker-caddy

build: dirs build-containers bootstrap-lerna build-relay build-react-app build-react-wallet ## builds all the packages and the containers for the relay
	$(log_end)

test-client: build-lerna ## runs "./packages/client" tests against the locally running relay. Make sure you run 'make dev' before.
	npm run test --prefix packages/client

test-staging: build-lerna ## tests client against staging.walletconnect.org
	TEST_RELAY_URL=wss://staging.walletconnect.org npm run test --prefix packages/client

test-production: build-lerna ## tests client against relay.walletconnect.org
	TEST_RELAY_URL=wss://relay.walletconnect.org npm run test --prefix packages/client

test-relay: ## runs "./servers/relay" tests against the locally running relay. Make sure you run 'make dev' before. Also needs waku nodes running locally
	npm run test --prefix servers/relay

start-redis: ## starts redis docker container for local development
	docker run --rm --name $(standAloneRedis) -d -p 6379:6379 $(redisImage) || true
	$(log_end)

predeploy: dirs setup pull build-containers 

dev: predeploy ## runs relay on watch mode and shows logs
	RELAY_URL=localhost bash ops/deploy.sh
	@echo  "MAKE: Done with $@"
	@echo
	$(log_end)

ci: predeploy ## runs tests in github actions
	printf "export RELAY_URL=localhost\nexport CERTBOT_EMAIL=\nexport CLOUDFLARE_CERT=false\n" > setup
	NODE_ENV=development $(MAKE) deploy
	sleep 15
	docker service logs --tail 100 $(project)_caddy
	docker service logs --tail 100 $(project)_relay
	TEST_RELAY_URL=wss://localhost $(MAKE) test-client

deploy: predeploy ## deploys the docker swarm for the relay
	bash ops/deploy.sh
	$(log_end)

deploy-no-monitoring: predeploy ## same as deploy but without the monitoring
	MONITORING=false bash ops/deploy.sh
	$(log_end)

redeploy: clean predeploy ## redeploys the prodution containers and rebuilds them
	docker service update --force --image $(caddyImage) $(project)_caddy
	docker service update --force --image $(relayImage) $(project)_relay

relay-logs: ## follows the relay container logs. Doesn't work with 'make dev'
	docker service logs -f --raw --tail 100 $(project)_relay

cachix: clean build-docker-relay build-docker-caddy ## pushes docker images to cachix
	cachix push walletconnect build/build-docker-relay
	cachix push walletconnect build/build-docker-caddy

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
