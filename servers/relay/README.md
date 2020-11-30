# WalletConnect Bridge Server ⏮️🖥️⏭️

Bridge Server for relaying WalletConnect connections

## Development 🧪

Local dev work is using local self signed certificates withing the docker environment.

Your Walletconnect enabled app needs to be on the same local network.

```
make dev # ports 80, 443, 5555, 6379 will be exposed locally
```

## Production 🗜️

#### Setting up docker 🎚️

Dependencies:

- git
- docker
- make

You will need to have docker swarm enabled:

```bash
docker swarm init
# If you get the following error: `could not chose an IP address to advertise...`. You can do the following:
docker swarm init --advertise-addr `curl -s ipecho.net/plain`
```

### Deploying 🚀

Run the following command and fill in the prompts:

```bash
git clone https://github.com/WalletConnect/walletconnect-v2-bridge
cd walletconnect-v2-bridge
make deploy
Bridge URL domain: <your bridge domain>
Email for SSL certificate (default noreply@gmail.com):
```

### Upgrading ⏫

This will upgrade your current bridge with minimal downtime.

⚠️ ATTENTION: This will run `git fetch && git merge origin/master` in your repo ⚠️

```bash
make upgrade
```

### Monitoring 📜

This stack deploys 3 containers one of redis, nginx and node.js. You can follow the logs of the nginx container by running the following command:

```
docker service logs --raw -f walletconnect_nginx
```
