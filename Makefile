SHELL := /bin/bash

# Shamelessly stolen from https://www.freecodecamp.org/news/self-documenting-makefile
.PHONY: help
help: ## Show this help
	@egrep -h '\s##\s' Makefile \
		| sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

DOCKER_COMPOSE=-f ./build/package/docker-compose.yml
DOCKER_COMPOSE_DEV=-f ./build/package/docker-compose.dev.yml -f ./build/package/docker-compose.override.yml
DOCKER_COMPOSE_TEST=-f ./build/package/docker-compose.test.yml

### Production build/publish
.PHONY: build
build: ## build docker images
	@docker-compose $(DOCKER_COMPOSE) build

.PHONY: publish
publish: ## push docker images to docker hub
	@docker-compose $(DOCKER_COMPOSE) push

### Dev build/publis
.PHONY: build-dev
build-dev: ## build docker images for dev enviromnent 
	@docker-compose $(DOCKER_COMPOSE_DEV) build health relay

.PHONY: publish-dev
publish-dev: ## push docker images for dev environment to the docker hub
	@docker-compose $(DOCKER_COMPOSE_DEV) push health relay

# Local dev environment helpers
.PHONY: dev
dev: ## start local dev environment
ifeq (,$(fast))
	@make build-dev
endif
	@docker-compose $(DOCKER_COMPOSE_DEV) up -d

.PHONY: stop
stop: ## stop local environment 
	@docker-compose $(DOCKER_COMPOSE_DEV) stop

.PHONY: clean
clean: stop ## clean local environment 
	@docker-compose $(DOCKER_COMPOSE_DEV) rm -f

logs: ## show logs for docker containers. To get logs for a single container uses `make logs service=relay`
	@docker-compose $(DOCKER_COMPOSE_DEV) logs ${service}

.PHONY: ps
ps: ## show docker container status
	@docker-compose $(DOCKER_COMPOSE_DEV) ps

### Testing 
.PHONY: test
test: test-relay test-client

.PHONY: test-relay
test-relay:  ## runs "./servers/relay" tests against the locally running relay
	@docker-compose $(DOCKER_COMPOSE_DEV) $(DOCKER_COMPOSE_TEST) \
		run --rm -e TEST_RELAY_URL=ws://relay:5000 \
		monorepo \
		npm run test 

.PHONY: test-client
test-client:  ## runs "./packages/client" tests against the locally running relay
	@docker-compose $(DOCKER_COMPOSE_DEV) $(DOCKER_COMPOSE_TEST) \
		run --rm monorepo \
		npm run test --prefix packages/client

.PHONY: test-staging
test-staging: ## runs "./packages/client" tests against the staging.walletconnect.com
	@docker-compose $(DOCKER_COMPOSE_DEV) $(DOCKER_COMPOSE_TEST) \
		run --rm -e TEST_RELAY_URL=ws://staging.walletconnect.com \
		monorepo \
		npm run test --prefix packages/client	

.PHONY: test-production
test-production: build-lerna ## runs "./packages/client" tests against the relay.walletconnect.com
	@docker-compose $(DOCKER_COMPOSE_DEV) $(DOCKER_COMPOSE_TEST) \
		run --rm -e TEST_RELAY_URL=ws://relay.walletconnect.com \
		monorepo \
		npm run test --prefix packages/client	
