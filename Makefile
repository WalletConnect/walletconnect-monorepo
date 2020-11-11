### Deploy configs
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
project=walletconnect
redisImage='redis:5-alpine'
nginxImage='$(project)/nginx:$(BRANCH)'
walletConnectImage='$(project)/relay:$(BRANCH)'

### Makefile internal coordination
flags=.makeFlags
VPATH=$(flags)

$(shell mkdir -p $(flags))

.PHONY: all clean default
define DEFAULT_TEXT
Available make rules:

pull:\tdownloads docker images

setup:\tconfigures domain an certbot email

build-relay:\tbuilds relay docker image

build-nginx:\tbuilds nginx docker image

build:\tbuilds docker images

test-client:\truns client tests

relay-logs:\tdisplays relay logs

relay-watch:\truns relay on watch mode

relay-dev:\truns relay on watch mode and display logs

dev:\truns local docker stack with open ports

cloudflare: asks for a cloudflare DNS api and creates a docker secret

redeploy:\tredeploys to production

deploy:\tdeploys to production

deploy-monitoring:
\tdeploys to production with grafana

stop:\tstops all walletconnect docker stacks

upgrade:
\tpulls from remote git. Builds the containers and updates each individual
\tcontainer currently running with the new version that was just built.

reset:\treset local config

clean:\tcleans current docker build

clean-all:\tcleans current all local config

endef

### Rules
export DEFAULT_TEXT
default:
	@echo -e "$$DEFAULT_TEXT"

pull:
	docker pull $(redisImage)
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

setup:
	@read -p 'Relay URL domain: ' relay; \
	echo "RELAY_URL="$$relay > config
	@read -p 'Email for SSL certificate (default noreply@gmail.com): ' email; \
	echo "CERTBOT_EMAIL="$$email >> config
	@read -p 'Is your DNS configured with cloudflare proxy? [y/N]: ' cf; \
	echo "CLOUDFLARE="$${cf:-false} >> config
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

build-relay:
	docker build \
		-t $(walletConnectImage) \
		--build-arg BRANCH=$(BRANCH) \
		-f ops/relay.Dockerfile .
	@touch $(flags)/$@
	@echo "MAKE: Done with $@"
	@echo

build-nginx: pull
	docker build \
		-t $(nginxImage) \
		--build-arg BRANCH=$(BRANCH) \
		-f ops/nginx/nginx.Dockerfile ./ops/nginx
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

build-lerna:
	lerna run build

build: pull build-lerna build-relay build-nginx
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

test-client:
	cd ./packages/client; npm run test; cd -

relay-logs:
	docker service logs -f --raw dev_$(project)_relay --tail 500

watch:
	lerna run watch --stream --parallel

relay-dev: dev relay-watch relay-logs

dev: pull build
	RELAY_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	docker stack deploy \
	-c ops/docker-compose.yml \
	-c ops/docker-compose.dev.yml \
	dev_$(project)
	@echo  "MAKE: Done with $@"
	@echo


dev-monitoring: pull build
	RELAY_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	docker stack deploy \
	-c ops/docker-compose.yml \
	-c ops/docker-compose.dev.yml \
	-c ops/docker-compose.monitor.yml \
	dev_$(project)
	@echo  "MAKE: Done with $@"
	@echo

cloudflare: setup
	bash ops/cloudflare-secret.sh $(project)
	@touch $(flags)/$@
	@echo  "MAKE: Done with $@"
	@echo

redeploy: 
	$(MAKE) clean
	$(MAKE) down
	$(MAKE) dev-monitoring

deploy: setup build cloudflare
	RELAY_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	PROJECT=$(project) \
	bash ops/deploy.sh
	@echo  "MAKE: Done with $@"
	@echo

deploy-monitoring: setup build cloudflare
	RELAY_IMAGE=$(walletConnectImage) \
	NGINX_IMAGE=$(nginxImage) \
	PROJECT=$(project) \
	MONITORING=true \
	bash ops/deploy.sh
	@echo  "MAKE: Done with $@"
	@echo

down: stop

stop: 
	docker stack rm $(project)
	docker stack rm dev_$(project)
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo
	while [ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=dev_$(project)`" ]; do echo -n '.' && sleep 1; done
	@echo  "MAKE: Done with $@"
	@echo

upgrade: setup
	rm -f $(flags)/build*
	$(MAKE) build
	@echo  "MAKE: Done with $@"
	@echo
	git fetch origin $(BRANCH)
	git merge origin/$(BRANCH)
	docker service update --force $(project)_relay
	docker service update --force $(project)_nginx
	docker service update --force $(project)_redis

reset:
	$(MAKE) clean-all
	rm -f config
	@echo  "MAKE: Done with $@"
	@echo

clean:
	rm -rf .makeFlags/build*
	@echo  "MAKE: Done with $@"
	@echo

clean-all:
	rm -rf .makeFlags
	@echo  "MAKE: Done with $@"
	@echo
