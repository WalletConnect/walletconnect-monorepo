#!/usr/bin/env bash
# Context: https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
set -Eeuo pipefail

file_location="packages/core/src/constants/relayer.ts"
regex='RELAYER_SDK_VERSION = ".*"'

# Get the next version from lerna.json.
lerna_file="lerna.json"
next_version=$(grep -Eo '"version": *"[^"]+"' "$lerna_file" | sed -E 's/.*"version": *"([^"]+)".*/\1/')

# Define the replace value
new_value="RELAYER_SDK_VERSION = \"$next_version\""

echo "[SCRIPT] Updating RELAYER_SDK_VERSION to $next_version in $file_location..."

# Use sed to update the value in the file
if sed --version >/dev/null 2>&1; then
  sed -i "s|$regex|$new_value|g" "$file_location"
else
  sed -i '' "s|$regex|$new_value|g" "$file_location"
fi

echo "[SCRIPT] ...Done!"
