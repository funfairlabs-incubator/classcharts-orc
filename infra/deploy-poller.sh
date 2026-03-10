#!/usr/bin/env bash
# infra/deploy-poller.sh — Deploy or update the Cloud Run poller
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE_NAME="classcharts-poller"
SA_EMAIL="classcharts-poller-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "▶ Building and deploying Cloud Run service: $SERVICE_NAME"

cd "$(dirname "$0")/.."

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --dockerfile Dockerfile.poller \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --no-allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60 \
  --max-instances 1 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --project "$PROJECT_ID"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" --format 'value(status.url)')

echo ""
echo "✅ Deployed: $SERVICE_URL"
echo ""
echo "▶ Creating Pub/Sub push subscription..."

gcloud pubsub subscriptions create classcharts-poll-sub \
  --topic=classcharts-poll \
  --push-endpoint="$SERVICE_URL/" \
  --push-auth-service-account="$SA_EMAIL" \
  --ack-deadline=60 \
  2>/dev/null || echo "Subscription already exists"

echo ""
echo "✅ Poller fully deployed and wired to Pub/Sub"
echo "   Secrets still need setting — use Secret Manager or gcloud run services update --set-secrets"
