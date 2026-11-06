#!/usr/bin/env bash
# Fails if code crosses a layer boundary (see CLAUDE.md). Scans tracked and new files; skips anything git-ignored.
set -uo pipefail
cd "$(dirname "$0")/.."

failed=0
# rule <description> <regex> <paths...> -- <allowed pathspecs...>
rule() {
  local description=$1 pattern=$2; shift 2
  local paths=() allowed=()
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do paths+=("$1"); shift; done
  [ $# -gt 0 ] && shift
  for a in "$@"; do allowed+=(":(exclude)$a"); done
  local hits status
  # ${allowed[@]+...}: an empty array is "unbound" under set -u in macOS's bash 3.2.
  hits=$(git grep --untracked -n -E "$pattern" -- "${paths[@]}" ${allowed[@]+"${allowed[@]}"})
  status=$?
  # git grep: 0 = matches, 1 = no matches, anything else = the check itself broke. Never pass on a broken check.
  if [ $status -gt 1 ]; then
    printf '  \033[31m✗\033[0m %s (check could not run: git grep exit %s)\n' "$description" "$status"
    failed=1
  elif [ -n "$hits" ]; then
    printf '  \033[31m✗\033[0m %s\n%s\n' "$description" "$(printf '%s\n' "$hits" | sed 's/^/      /')"
    failed=1
  else
    printf '  \033[32m✓\033[0m %s\n' "$description"
  fi
}

echo "Boundary check"

# Backend
rule "Only the product adapter knows Fake Store" 'fakestoreapi' backend/src -- backend/src/products backend/src/config.ts
rule "Only SmtpMailer knows nodemailer" 'nodemailer' backend/src -- backend/src/mail/SmtpMailer.ts
rule "Only the HTTP layer imports Express" 'from "express' backend/src -- backend/src/http backend/src/app.ts
rule "Services depend on interfaces, not concrete adapters" \
  'FakeStoreProductSource|SmtpMailer|loaders\.js' backend/src/catalogue backend/src/enquiries backend/src/http
rule "domain/ imports only domain/" 'from "\.\./' backend/src/domain

# iOS
rule "Only LiveAPIClient uses URLSession" 'URLSession' ios/Catalogue -- ios/Catalogue/Networking/LiveAPIClient.swift
rule "Only the app's composition root creates the real API client" 'LiveAPIClient' ios/Catalogue -- ios/Catalogue/Networking ios/Catalogue/App/CatalogueApp.swift
rule "No literal colours, fonts or materials outside Theme" \
  'Color\.(red|green|blue|white|black|gray|orange|yellow|pink|purple)|Color\(red:|Font\.(system|largeTitle|title|headline|subheadline|body|callout|footnote|caption)|\.font\(\.[a-zA-Z]|\.(foregroundStyle|foregroundColor|tint|background)\(\.(red|green|blue|white|black|gray|orange|yellow|pink|purple|bar|thinMaterial|regularMaterial|thickMaterial|ultraThinMaterial|ultraThickMaterial)[),]' \
  ios/Catalogue -- ios/Catalogue/Theme
rule "The app never names the product source's host" 'fakestoreapi' ios

exit $failed
