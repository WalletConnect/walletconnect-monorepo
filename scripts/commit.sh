# this script is used to commit version updates after changeset version including lerna.json & relayer version
echo "Staging changes..."
git add .

# Commit the changes
echo "Committing the changes..."
git commit -m "chore: update versions and lerna.json"

echo "✅ Version updates and lerna.json changes committed."
