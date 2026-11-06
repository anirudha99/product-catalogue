#!/usr/bin/env bash
# End-to-end check against the running stack (docker compose up).
# Proves the enquiry acceptance criterion: enquiry in → email in the sales inbox (Mailpit).
# Needs only bash, curl and grep. Sends one enquiry (the API allows 5 per 15 minutes per client).
set -euo pipefail

API="${API:-http://localhost:3000}"
MAILPIT="${MAILPIT:-http://localhost:8025}"
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "Smoke test: $API (mail: $MAILPIT)"

curl -fsS "$API/health" | grep -q '"status":"ok"' && pass "API is up" || fail "API not reachable at $API (run: docker compose up)"

home=$(curl -fsS "$API/v1/home") || fail "GET /v1/home failed"
count=$(printf '%s' "$home" | grep -o '"imagePath"' | wc -l | tr -d ' ')
[ "$count" -ge 1 ] && pass "Home lists $count featured products" || fail "Home has no featured products"

curl -fsS -o /dev/null -w '%{content_type}' "$API/v1/products/3/image" | grep -q '^image/' \
  && pass "Image proxy returns an image" || fail "Image proxy did not return an image"

response=$(curl -sS -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -d '{"productId":"3","name":"Smoke Test","email":"smoke@example.test","message":"Automated smoke test"}' \
  "$API/v1/enquiries")
status=$(printf '%s' "$response" | tail -n1)
body=$(printf '%s' "$response" | sed '$d')
[ "$status" = "202" ] || fail "POST /v1/enquiries returned $status: $body"
reference=$(printf '%s' "$body" | grep -o '"reference":"[^"]*"' | cut -d'"' -f4)
[ -n "$reference" ] && pass "Enquiry accepted (reference $reference)" || fail "No reference in: $body"

# The email is sent before the API answers, so it should already be there; allow a moment anyway.
for _ in 1 2 3 4 5; do
  if curl -fsS "$MAILPIT/api/v1/search?query=$reference" | grep -q "\"messages_count\":[1-9]"; then
    pass "Sales inbox received the email (search for $reference)"
    echo "All good. See the email at $MAILPIT"
    exit 0
  fi
  sleep 1
done
fail "No email with reference $reference in Mailpit"
