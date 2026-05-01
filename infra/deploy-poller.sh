#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE="classcharts-poller"
SA="classcharts-poller-sa@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "▶ Building and pushing Docker image..."
cd "$(dirname "$0")/.."

# Submit build and wait for completion without streaming logs
# (SA lacks roles/logging.viewer needed to stream)
BUILD_ID=$(gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE}" \
  --async \
  --format='value(id)' \
  .)

echo "▶ Build submitted: ${BUILD_ID}"
echo "  Logs: https://console.cloud.google.com/cloud-build/builds/${BUILD_ID}?project=${PROJECT_ID}"

# Poll until complete
echo "▶ Waiting for build..."
while true; do
  STATUS=$(gcloud builds describe "${BUILD_ID}" --format='value(status)' 2>/dev/null)
  echo "  Status: ${STATUS}"
  if [ "$STATUS" = "SUCCESS" ]; then break; fi
  if [ "$STATUS" = "FAILURE" ] || [ "$STATUS" = "CANCELLED" ] || [ "$STATUS" = "TIMEOUT" ]; then
    echo "ERROR: Build ${BUILD_ID} failed with status ${STATUS}"
    echo "  View logs: https://console.cloud.google.com/cloud-build/builds/${BUILD_ID}?project=${PROJECT_ID}"
    exit 1
  fi
  sleep 10
done

echo "▶ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$SA" \
  --no-allow-unauthenticated \
  --set-secrets="CLASSCHARTS_PARENT1_EMAIL=CLASSCHARTS_PARENT1_EMAIL:latest,CLASSCHARTS_PARENT1_PASSWORD=CLASSCHARTS_PARENT1_PASSWORD:latest,GCP_PROJECT_ID=GCP_PROJECT_ID:latest,GCS_BUCKET=GCS_BUCKET:latest,GCS_ALLOWED_USERS_PATH=GCS_ALLOWED_USERS_PATH:latest,GMAIL_CLIENT_ID=GMAIL_CLIENT_ID:latest,GMAIL_CLIENT_SECRET=GMAIL_CLIENT_SECRET:latest,GMAIL_REFRESH_TOKEN=GMAIL_REFRESH_TOKEN:latest,GCAL_REFRESH_TOKEN=GCAL_REFRESH_TOKEN:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,PUSHOVER_API_TOKEN=PUSHOVER_API_TOKEN:latest,PUSHOVER_USER_KEY=PUSHOVER_USER_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,ADMIN_EMAIL=ADMIN_EMAIL:latest"

echo ""
echo "✅ Poller deployed!"
gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)"

# Re-grant Pub/Sub invoker — Cloud Run deployments can reset IAM bindings
PROJECT_NUMBER="306745837103"  # hardcoded — avoids Cloud Resource Manager API dependency
echo ""
echo "▶ Ensuring Pub/Sub can invoke Cloud Run..."
gcloud run services add-iam-policy-binding "$SERVICE" \
  --region="$REGION" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project="$PROJECT_ID" \
  --quiet
echo "✅ IAM binding confirmed"
