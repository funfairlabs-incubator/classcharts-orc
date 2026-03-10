#!/usr/bin/env bash
# Rename PARENT1_EMAIL -> CLASSCHARTS_PARENT1_EMAIL etc in Secret Manager
set -euo pipefail
PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"

fetch() { gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID"; }

echo "▶ Migrating parent credential secret names..."
EMAIL=$(fetch PARENT1_EMAIL)
PASSWORD=$(fetch PARENT1_PASSWORD)

echo -n "$EMAIL"    | gcloud secrets create CLASSCHARTS_PARENT1_EMAIL    --data-file=- --replication-policy=automatic --quiet 2>/dev/null || \
echo -n "$EMAIL"    | gcloud secrets versions add CLASSCHARTS_PARENT1_EMAIL    --data-file=- --quiet

echo -n "$PASSWORD" | gcloud secrets create CLASSCHARTS_PARENT1_PASSWORD --data-file=- --replication-policy=automatic --quiet 2>/dev/null || \
echo -n "$PASSWORD" | gcloud secrets versions add CLASSCHARTS_PARENT1_PASSWORD --data-file=- --quiet

echo "✅ Done. Old secrets PARENT1_EMAIL and PARENT1_PASSWORD can be deleted manually."
