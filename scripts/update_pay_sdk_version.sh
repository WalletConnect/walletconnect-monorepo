#!/bin/bash
# Context: https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
set -Eeuo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

file_location="$REPO_ROOT/packages/pay/src/constants/client.ts"
package_json="$REPO_ROOT/packages/pay/package.json"
regex="SDK_VERSION = \`.*\`"

# Get the version from packages/pay/package.json
next_version=$(grep -E '"version": "(.*)"' "$package_json" | head -1 | sed -E 's/.*"version": "(.*)".*/\1/')

# Define the replace value
new_value="SDK_VERSION = \`$next_version\`"

echo "[SCRIPT] Updating SDK_VERSION to $next_version in $file_location..."

# Use sed to update the value in the file
if [ "$(uname)" = "Darwin" ]; then
  # MacOS requires an empty string as the second argument to -i
  sed -i "" "s/${regex}/${new_value}/g" "$file_location"
else
  sed -i "s/${regex}/${new_value}/g" "$file_location"
fi

echo "[SCRIPT] ...Done!"
