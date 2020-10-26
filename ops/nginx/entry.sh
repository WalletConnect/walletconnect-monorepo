#!/bin/bash

# Set default variables
root_domain="${DOMAIN_URL:-localhost}"
manage_root_domain=${MANAGE_ROOT_DOMAIN:-true}
email="${EMAIL:-noreply@gmail.com}"
docker_containers="${SUBDOMAINS}"
app_container_dns_name="${CONTAINER_NAME}"
app_env="${APP_ENV:-development}"
app_port="${APP_PORT:-5555}"
app_qty="${APP_QTY:-5}"

LETSENCRYPT=/etc/letsencrypt/live
SERVERS=/etc/nginx/servers

echo "
USING ENVVARS:
root_domain=$root_domain
docker containers to proxy pass to (docker_containers)=$docker_containers
cert email=$email
app_env=$app_env
app_port=$app_port
app_qty=$app_qty
"

function makeCert () {
  fullDomain=$1
  certDirectory=$2
  if [[ "$fullDomain" =~ .*localhost.* && ! -f "$certDirectory/privkey.pem" ]]
  then
    echo "Developing locally, generating self-signed certs"
    openssl req -x509 -newkey rsa:4096 -keyout $certDirectory/privkey.pem -out $certDirectory/fullchain.pem -days 365 -nodes -subj '/CN=localhost'
  fi

  if [[ ! -f "$certDirectory/privkey.pem" ]]
  then
    echo "Couldn't find certs for $fullDomain, using certbot to initialize those now.."
    
    if [[ "${CLOUDFLARE:-false}" == false ]]; then
      certbot certonly --standalone -m $email --agree-tos --no-eff-email -d $fullDomain -n
    else
      echo "dns_cloudflare_api_token = $(cat /run/secrets/walletconnect_cloudflare)" > /run/secrets/cloudflare.ini
      certbot certonly --dns-cloudflare --dns-cloudflare-credentials /run/secrets/cloudflare.ini -d $fullDomain -m $email --agree-tos --no-eff-email -n
    fi

    if [[ ! $? -eq 0 ]] 
    then
      echo "ERROR"
      echo "Sleeping to not piss off certbot"
      sleep 9999 # FREEZE! Don't pester eff & get throttled
    fi
  fi
}

function waitForContainerToBeUp () {
  count=0
  while true; do
    ping -c 1 $1
    if [ $1 ]; then
      break
    fi
    if [[ $count -gt 20 ]]; then
      echo "Container $1 is not live! Exiting"
      exit 1
    fi
    count=$((1 + $count))
  done
}

function configSubDomain () {
  subDomain=$1
  dockerPort=$2
  rootDomain=$3
  fullDomain=$subDomain.$rootDomain
  echo "Configuring Subdomain: $fullDomain"
  certDirectory=$LETSENCRYPT/$fullDomain
  mkdir -vp $certDirectory
  makeCert "$fullDomain" $certDirectory
  cat - > "$SERVERS/$fullDomain.conf" <<EOF
server {
  listen  80;
  listen [::]:80;
  server_name $fullDomain;
  include /etc/nginx/letsencrypt.conf;
  location / {
    return 301 https://\$host\$request_uri;
  }
}
server {
  listen  443 ssl;
  listen [::]:443 ssl;
  ssl_certificate       $certDirectory/fullchain.pem;
  ssl_certificate_key   $certDirectory/privkey.pem;
  server_name $fullDomain;
  location / {
		proxy_pass "http://$subDomain:$dockerPort";
  }
}
EOF
}

function configLoadBalancingForApp () {
  configPath="${1:-$SERVERS/$1}"
  appQty=${2:-1}
  port=${3:-5555}
  dockerContainerName=$4
  if [[ ! $dockerContainerName ]]; then
    printf "Need to give the docker name of the main app. Quitting...\n"
    exit 1
  fi
  cat - >> $configPath<<EOF
upstream app {
  server $dockerContainerName:$port max_fails=1 fail_timeout=5s;
}
EOF
}

function configRootDomain () {
  domain=$1
  printf "\nConfiguring root domain: $domain\n"
  certDirectory=$LETSENCRYPT/$domain
  mkdir -vp $certDirectory
  makeCert $domain $certDirectory
  configPath="$SERVERS/$domain.conf"
  cat - > $configPath <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $domain;
  include /etc/nginx/letsencrypt.conf;
  location / {
    return 301 https://\$host\$request_uri;
  }
}
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name $domain;
  # https://stackoverflow.com/questions/35744650/docker-network-nginx-resolver
  resolver 127.0.0.11 valid=30s;
 
  ssl_certificate           $certDirectory/fullchain.pem;
  ssl_certificate_key       $certDirectory/privkey.pem;

  location / {
    proxy_read_timeout      1800;
    proxy_send_timeout      1800;
    keepalive_timeout       1800;
    add_header "Access-Control-Allow-Origin"  *;
    proxy_set_header        Host \$host;
    proxy_set_header        http_x_forwarded_for  \$remote_addr;
    proxy_pass              http://app;

    # Websocket must have configs
    proxy_http_version      1.1;
    proxy_set_header        Upgrade \$http_upgrade;
    proxy_set_header        Connection "Upgrade";
  
  }
}
EOF
}

# periodically fork off & see if our certs need to be renewed
function renewcerts {
  domain=$1
  while true; do
    if [[ -d "$LETSENCRYPT" ]]
    then
      certbot renew --webroot -w /var/www/letsencrypt/ -n
    fi
    sleep 48h
  done
}

function main () {

  mkdir -vp $LETSENCRYPT
  mkdir -vp $SERVERS
  mkdir -vp /var/www/letsencrypt

  for container_port in $docker_containers; do
    port=$(echo $container_port | cut -d':' -f 2)
    container=$(echo $container_port | cut -d':' -f 1)
    waitForContainerToBeUp $container
    configSubDomain $container $port $root_domain 
  done

  if [[ $manage_root_domain ]]; then
    configRootDomain $root_domain
    #arguments: configPath appQty port dockerContainerName
    configLoadBalancingForApp "$SERVERS/$root_domain.conf" \
      $app_qty \
      $app_port \
      $app_container_dns_name
  fi

  if [[ "$fullDomain" != "localhost" ]]
  then
    echo "Forking renewcerts to the background for $fullDomain..."
    renewcerts $fullDomain &
  fi

  sleep 4 # give renewcerts a sec to do it's first check

  echo "Entrypoint finished, executing nginx..."; echo
  exec nginx
}

main
