### Deploy configs
BRANCH=$(shell git for-each-ref --format='%(objectname) %(refname:short)' refs/heads | awk "/^$$(git rev-parse HEAD)/ {print \$$2}")
REMOTE="https://github.com/WalletConnect/walletconnect-v2-bridge"
REMOTE_HASH=$(shell git ls-remote $(REMOTE) $(BRANCH) | head -n1 | cut -f1)
project=walletconnect
redisImage='redis:5-alpine'
nginxImage='walletconnect/nginx:$(BRANCH)'
walletConnectImage='walletconnect/proxy:$(BRANCH)'

BRIDGE_URL=$(shell cat config | grep BRIDGE_URL | cut -f2 -d=)
CERTBOT_EMAIL=$(shell cat config | grep CERTBOT_EMAIL | cut -f2 -d=)

### Makefile internal coordination
flags=.makeFlags
VPATH=$(flags)

$(shell mkdir -p $(flags))

.PHONY: all clean default

### Rules
default:
	@echo
	@echo "Available make rules: "
	@echo "pull:          pulls docker images"
	@echo "setup:         configures domain an certbot email"
	@echo "build:         builds docker images"
	@echo "dev:           runs local docker stack with open ports"
	@echo "deploy:        deploys to production"
	@echo "stop:          stops all walletconnect docker stacks"
	@echo "upgrade:       stops current docker stack. Pulls from remote git. Runs deploys production using deploy rule"
	@echo "clean:         cleans current docker build"
	@echo "reset:         reset local config"

pull:
	docker pull $(redisImage)
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

setup:
	@read -p 'Bridge URL domain: ' bridge; \
	echo "BRIDGE_URL="$$bridge > config
	@read -p 'Email for SSL certificate (default noreply@gmail.com): ' email; \
	echo "CERTBOT_EMAIL="$$email >> config
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

build-node: pull
	docker build \
		-t $(walletConnectImage) \
		--build-arg BRANCH=$(BRANCH) \
		--build-arg REMOTE_HASH=$(REMOTE_HASH) \
		-f ops/node.Dockerfile .
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

build-nginx: pull
	docker build \
		-t $(nginxImage) \
		--no-cache \
		--build-arg BRANCH=$(BRANCH) \
		--build-arg REMOTE_HASH=$(REMOTE_HASH) \
		-f ops/nginx.Dockerfile .
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build: pull build-node build-nginx
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

dev: build
	WALLET_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	docker stack deploy \
	-c ops/docker-compose.yml \
	-c ops/docker-compose.dev.yml \
	dev_$(project)
	@echo  "MAKE: Done with $@"
	@echo

deploy: setup build
	WALLET_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	BRIDGE_URL=$(BRIDGE_URL) \
	CERTBOT_EMAIL=$(CERTBOT_EMAIL) \
	docker stack deploy -c ops/docker-compose.yml \
	-c ops/docker-compose.prod.yml $(project)
	@echo  "MAKE: Done with $@"
	@echo

stop: 
	docker stack rm $(project)
	docker stack rm dev_$(project)
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=dev_$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo  "MAKE: Done with $@"
	@echo

upgrade: stop
	git fetch origin $(BRANCH)
	git merge origin/$(BRANCH)
	$(MAKE) deploy
	@echo  "MAKE: Done with $@"
	@echo

reset:
	rm -rf .makeFlags
	rm -f config
	@echo  "MAKE: Done with $@"
	@echo

clean:
	rm -rf .makeFlags/build*
	@echo  "MAKE: Done with $@"
	@echo
