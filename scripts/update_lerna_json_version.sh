#!/bin/sh

core_file="./packages/core/package.json"
lerna_file="lerna.json"

# Extract version safely (no trailing comma or period)
version=$(grep -E '"version"[[:space:]]*:[[:space:]]*"' "$core_file" | \
         sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

if [ -z "$version" ]; then
  echo "Error: Could not extract version from $core_file"
  exit 1
fi


# Use sed to update the value in the file
if [ "$(uname)" = "Darwin" ]; then
  # MacOS requires an empty string as the second argument to -i
  sed -i "" -E "s/(\"version\": \")[^\"]+\"/\1$version\"/" "$lerna_file"
else
  sed -i -E "s/(\"version\": \")[^\"]+\"/\1$version\"/" "$lerna_file"
fi

echo "Updated $lerna_file to version $version"
