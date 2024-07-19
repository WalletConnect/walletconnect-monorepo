#!/bin/bash
# Context: https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
set -Eeuo pipefail

file_location="packages/web3wallet/package.json"

# Get the next version from lerna.json.
lerna_file="lerna.json"
lerna_version=$(grep -E '"version": "(.*)"' $lerna_file | sed -E 's/"version": "(.*)"/\1/' | sed 's/^[[:space:]]*//')

IFS='.' read -r -a VERSION_PARTS <<< "$lerna_version"
MAJOR_VERSION=${VERSION_PARTS[0]}
MINOR_VERSION=${VERSION_PARTS[1]}
PATCH_VERSION=${VERSION_PARTS[2]}
echo "major version: $MAJOR_VERSION"
echo "minor version: $MINOR_VERSION"
echo "patch version: $PATCH_VERSION"

# web3wallet version is always one major & one minor version behind the lerna version
next_web3wallet_version="$((MAJOR_VERSION - 1)).$((MINOR_VERSION - 1)).$PATCH_VERSION"

echo "[SCRIPT] Updating Web3wallet version to $next_web3wallet_version in $file_location..."
# Use sed to update the value in the file
if [ "$(uname)" = "Darwin" ]; then
  # MacOS requires an empty string as the second argument to -i
  sed -i '' -E "s/\"version\": \"[^\"]+\"/\"version\": \"$next_web3wallet_version\"/" "$file_location"
else
  sed -i -E "s/\"version\": \"[^\"]+\"/\"version\": \"$next_web3wallet_version\"/" "$file_location"
fi

echo "[SCRIPT] Version updated to $next_web3wallet_version in $file_location"

echo "[SCRIPT] ...Done!"