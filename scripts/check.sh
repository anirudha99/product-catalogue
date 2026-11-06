#!/usr/bin/env bash
# Runs everything that should be green before a commit: formatting, backend tests, iOS tests, boundary check.
# Backend tests use local Node if it is >= 22.12, otherwise Docker (no local Node needed).
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Backend tests"
if command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)'; then
  (cd backend && { [ -d node_modules ] || npm ci --no-fund --no-audit; } && npm run --silent format:check && npm run --silent typecheck && npm test --silent)
else
  echo "Local Node missing or older than 22.12; running the tests in Docker."
  docker compose --profile test run --rm --build api-test sh -c 'npm run --silent format:check && npm test'
fi

step "iOS formatting (swift-format, ships with Xcode)"
xcrun swift-format lint --strict -r ios/Catalogue ios/CatalogueTests
echo "Swift formatting OK."

step "iOS tests"
SIMULATOR_ID=${SIMULATOR_ID:-$(xcrun simctl list devices available -j | python3 -I -c '
import json, sys
runtimes = json.load(sys.stdin)["devices"]
for runtime in sorted(runtimes, reverse=True):           # newest iOS first
    if ".iOS-" in runtime:
        for device in runtimes[runtime]:
            if device["name"].startswith("iPhone"):
                print(device["udid"]); sys.exit()
sys.exit("No iPhone simulator found. Install one in Xcode > Settings > Components.")
')}
echo "Simulator: $SIMULATOR_ID"
xcodebuild test -quiet -project ios/Catalogue.xcodeproj -scheme Catalogue -destination "id=$SIMULATOR_ID"
echo "iOS tests passed."

step "Boundaries"
scripts/check-boundaries.sh

printf '\n\033[32mAll checks passed.\033[0m\n'
