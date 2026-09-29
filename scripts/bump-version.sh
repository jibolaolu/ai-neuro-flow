#!/usr/bin/env bash
# Bump the semantic version, tag, and commit.
# Usage: ./scripts/bump-version.sh [major|minor|patch]
set -euo pipefail

BUMP=${1:-patch}
VERSION_FILE="VERSION"

if [ ! -f "$VERSION_FILE" ]; then
  echo "0.1.0" > "$VERSION_FILE"
fi

CURRENT=$(cat "$VERSION_FILE")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *)     echo "Usage: $0 [major|minor|patch]"; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "$NEW_VERSION" > "$VERSION_FILE"

git add "$VERSION_FILE"
git commit -m "chore: bump version to v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"

echo "Bumped ${CURRENT} → ${NEW_VERSION} and tagged v${NEW_VERSION}"
echo "Run: git push && git push --tags"
