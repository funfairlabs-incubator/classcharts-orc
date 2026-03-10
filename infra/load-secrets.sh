#!/usr/bin/env bash
# Loads all .env vars into GCP Secret Manager in parallel
set -euo pipefail

ENV_FILE="${1:-../.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

echo "▶ Loading secrets from $ENV_FILE into Secret Manager..."

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ -z "$key" || "$key" == \#* ]] && continue
  # Strip inline comments and whitespace
  value="${value%%#*}"
  value="${value// /}"
  [[ -z "$value" ]] && continue

  (
    if gcloud secrets describe "$key" &>/dev/null; then
      echo -n "$value" | gcloud secrets versions add "$key" --data-file=- --quiet
      echo "  ✓ updated: $key"
    else
      echo -n "$value" | gcloud secrets create "$key" --data-file=- --replication-policy=automatic --quiet
      echo "  ✓ created: $key"
    fi
  ) &

done < "$ENV_FILE"

wait
echo ""
echo "✅ All secrets loaded!"
