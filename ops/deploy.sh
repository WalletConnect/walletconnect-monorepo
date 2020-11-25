#!/usr/bin/env bash

monitoring=${MONITORING:-false} # this makes a bash string, not a boolean

export RELAY_URL=$(grep RELAY_URL config | cut -f2 -d=)
export CERTBOT_EMAIL=$(grep CERTBOT_EMAIL config | cut -f2 -d=)
export CLOUDFLARE=$(grep CLOUDFLARE config | cut -f2 -d=)

run="docker stack deploy $PROJECT -c ops/docker-compose.yml -c ops/docker-compose.prod.yml "
if [[ $CLOUDFLARE != false ]]; then
  run="${run} -c /tmp/${PROJECT}.secrets.yml"
fi

if [[ $monitoring != false ]]; then
  run="${run} -c ops/docker-compose.monitor.yml"
fi

printf "\nDeploy command: $run\n\n"
exec $run
