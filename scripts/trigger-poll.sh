#!/usr/bin/env bash
# Manually triggers a single poll via Cloud Run — useful for testing
# or forcing calendar config creation before backfill.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE_URL="https://classcharts-poller-306745837103.europe-west2.run.app"

echo "▶ Fetching identity token..."
TOKEN=$(gcloud auth print-identity-token)

echo "▶ Triggering poll..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVICE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"scheduled"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)
echo "HTTP $HTTP_CODE: $BODY"

echo ""
echo "✅ Done — calendar config should now exist in GCS"
echo "   You can now run: cd scripts && npm run backfill-calendar:dry"
