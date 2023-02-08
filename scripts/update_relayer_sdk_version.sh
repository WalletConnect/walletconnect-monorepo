#!/bin/bash

file_location="packages/core/src/constants/relayer.ts"
regex="RELAYER_SDK_VERSION = \".*\""

# Get the next version from user input.
echo "Enter new Relayer SDK version (should match the packages): "
read next_version

# Define the replace value
new_value="RELAYER_SDK_VERSION = \"$next_version\""

echo "[SCRIPT] Updating RELAYER_SDK_VERSION to $next_version in $file_location..."

# Use sed to update the value in the file
if [ "$(uname)" = "Darwin" ]; then
  # MacOS requires an empty string as the second argument to -i
  sed -i "" "s/${regex}/${new_value}/g" $file_location
else
  sed -i "s/${regex}/${new_value}/g" $file_location
fi


echo "[SCRIPT] ...Done!"
