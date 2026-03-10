#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE="classcharts-poller"
SA="classcharts-poller-sa@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "▶ Building and pushing Docker image..."
cd "$(dirname "$0")/.."

gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE}" \
  .

echo "▶ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$SA" \
  --no-allow-unauthenticated \
  --set-secrets="PARENT1_EMAIL=PARENT1_EMAIL:latest,PARENT1_PASSWORD=PARENT1_PASSWORD:latest,GCP_PROJECT_ID=GCP_PROJECT_ID:latest,GCS_BUCKET=GCS_BUCKET:latest,GCS_ALLOWED_USERS_PATH=GCS_ALLOWED_USERS_PATH:latest,GMAIL_CLIENT_ID=GMAIL_CLIENT_ID:latest,GMAIL_CLIENT_SECRET=GMAIL_CLIENT_SECRET:latest,GMAIL_REFRESH_TOKEN=GMAIL_REFRESH_TOKEN:latest,GCAL_REFRESH_TOKEN=GCAL_REFRESH_TOKEN:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,PUSHOVER_API_TOKEN=PUSHOVER_API_TOKEN:latest,PUSHOVER_USER_KEY=PUSHOVER_USER_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,POLL_INTERVAL_MINUTES=POLL_INTERVAL_MINUTES:latest"

echo ""
echo "✅ Poller deployed!"
gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)"
