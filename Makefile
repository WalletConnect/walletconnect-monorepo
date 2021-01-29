### Deploy configs
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
GITHASH=$(shell git rev-parse --short HEAD)
REMOTE=$(shell git remote show origin -n | grep Push | cut -f6 -d' ')
REMOTE_HASH=$(shell git ls-remote $(REMOTE) $(BRANCH) | head -n1 | cut -f1)
project=walletconnect
redisImage='redis:6-alpine'
standAloneRedis='xredis'
nginxImage='$(project)/nginx:$(BRANCH)'
relayImage='$(project)/relay:$(BRANCH)'
relayIndex=0

### Makefile internal coordination
flags=.makeFlags
VPATH=$(flags)
$(shell mkdir -p $(flags))
.PHONY: help clean clean-all reset

# Shamelessly stolen from https://www.freecodecamp.org/news/self-documenting-makefile
help: ## Show this help
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

pull: ## downloads docker images
	docker pull $(redisImage)
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

config: ## configures domain and certbot email
	@read -p 'Relay URL domain: ' relay; \
	echo "RELAY_URL="$$relay > config
	@read -p 'Email for SSL certificate (default noreply@gmail.com): ' email; \
	echo "CERTBOT_EMAIL="$$email >> config
	@read -p 'Is your DNS configured with cloudflare proxy? [y/N]: ' cf; \
	echo "CLOUDFLARE="$${cf:-false} >> config
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

bootstrap-lerna: ## setups lerna for the monorepo management
	npm i
	npx lerna link
	npx lerna bootstrap
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build-lerna: bootstrap-lerna ## builds the npm packages in "./packages"
	npx lerna run build
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build-container: ## builds relay docker image
	docker build \
		--build-arg githash=$(GITHASH) \
		-t $(relayImage) \
		-f ops/relay.Dockerfile .
	@echo "MAKE: Done with $@"
	@echo

build-relay: ## builds the relay system local npm
	npm install --prefix servers/relay
	npm run build --prefix servers/relay
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build-nginx: ## builds nginx docker image
	docker build \
		-t $(nginxImage) \
		--build-arg BRANCH=$(BRANCH) \
		-f ops/nginx/nginx.Dockerfile ./ops/nginx
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build: pull build-container build-nginx build-lerna ## builds all the packages and the containers for the relay
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

test-client: build-lerna ## runs "./packages/client" tests against the locally running relay. Make sure you run 'make dev' before.
	npm run test --prefix packages/client

test-staging: build-lerna ## tests client against staging.walletconnect.org
	TEST_RELAY_URL=wss://staging.walletconnect.org npm run test --prefix packages/client

test-production: build-lerna ## tests client against bridge.walletconnect.org
	TEST_RELAY_URL=wss://bridge.walletconnect.org npm run test --prefix packages/client

test-relay: build-relay## runs "./servers/relay" tests against the locally running relay. Make sure you run 'make dev' before.
	npm run test --prefix servers/relay
	
start-redis: ## starts redis docker container for local development
	docker run --rm --name $(standAloneRedis) -d -p 6379:6379 $(redisImage) || true
	@echo  "MAKE: Done with $@"
	@echo

dev: build-relay start-redis ## runs relay on watch mode and shows logs
	npm run dev --prefix servers/relay
	@echo  "MAKE: Done with $@"
	@echo

ci: ## runs tests in github actions
	printf "RELAY_URL=\nCERTBOT_EMAIL=\nCLOUDFLARE=false\n" > config
	NODE_ENV=development $(MAKE) deploy
	sleep 15
	docker service logs --tail 100 $(project)_nginx
	docker service logs --tail 100 $(project)_relay0
	TEST_RELAY_URL=wss://localhost $(MAKE) test-client
	TEST_RELAY_URL=wss://localhost $(MAKE) test-relay

cloudflare: config ## setups cloudflare API token secret
	bash ops/cloudflare-secret.sh $(project)
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

predeploy: config cloudflare pull build-container build-nginx

deploy: predeploy ## deploys production stack with './config' file contents
	RELAY_IMAGE=$(relayImage) \
	NGINX_IMAGE=$(nginxImage) \
	PROJECT=$(project) \
	bash ops/deploy.sh
	@echo  "MAKE: Done with $@"
	@echo

deploy-monitoring: predeploy ## same as deploy but also has monitoring stack
	RELAY_IMAGE=$(relayImage) \
	NGINX_IMAGE=$(nginxImage) \
	PROJECT=$(project) \
	MONITORING=true \
	bash ops/deploy.sh
	@echo  "MAKE: Done with $@"
	@echo

redeploy: clean predeploy ## redeploys the prodution containers and rebuilds them
	docker service update --force --image $(nginxImage) $(project)_nginx
	docker service update --force --image $(relayImage) $(project)_relay0
	docker service update --force --image $(relayImage) $(project)_relay1

relay-logs: ## follows the relay0 container logs. Doesn't work with 'make dev'
	docker service logs -f --raw --tail 100 $(project)_relay0

rm-redis: ## stops the redis container
	docker stop $(standAloneRedis) || true

down: stop ## alias of stop

stop: rm-redis ## stops the whole docker stack
	docker stack rm $(project)
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo
	@echo  "MAKE: Done with $@"
	@echo

reset: ## removes config and lerna bootstrap
	$(MAKE) clean-all
	rm -f config
	@echo  "MAKE: Done with $@"
	@echo

clean: ## removes all build outputs
	rm -rf .makeFlags/build*
	npm run clean --prefix servers/relay
	npx lerna run clean
	@echo  "MAKE: Done with $@"
	@echo

clean-all: clean ## cleans lerna bootstrap
	npx lerna clean -y
	rm -rf .makeFlags
	@echo  "MAKE: Done with $@"
	@echo
