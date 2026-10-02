#!/bin/bash
# Context: https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
set -Eeuo pipefail

# Get the next version from lerna.json.
lerna_file="lerna.json"
next_version=$(grep -E '"version": "(.*)"' $lerna_file | sed -E 's/"version": "(.*)"/\1/' | sed 's/^[[:space:]]*//')

update_version() {
  local file_location=$1
  local name=$2
  local regex="${name} = \".*\""
  local new_value="${name} = \"$next_version\""

  echo "[SCRIPT] Updating ${name} to $next_version in $file_location..."

  # Use sed to update the value in the file
  if [ "$(uname)" = "Darwin" ]; then
    # MacOS requires an empty string as the second argument to -i
    sed -i "" "s/${regex}/${new_value}/g" $file_location
  else
    sed -i "s/${regex}/${new_value}/g" $file_location
  fi
}

update_version "packages/core/src/constants/relayer.ts" "RELAYER_SDK_VERSION"
update_version "providers/universal-provider/src/constants/values.ts" "UNIVERSAL_PROVIDER_SDK_VERSION"

echo "[SCRIPT] ...Done!"
