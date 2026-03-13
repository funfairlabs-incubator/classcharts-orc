#!/usr/bin/env bash
# infra/setup.sh — One-time GCP resource setup
# Usage: ./setup.sh
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?Set GCS_BUCKET}"
REGION="${GCP_REGION:-europe-west2}"  # London — sensible UK default

echo "▶ Setting project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# ── Enable APIs ───────────────────────────────────────────────
echo "▶ Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  gmail.googleapis.com \
  secretmanager.googleapis.com \
  calendar-json.googleapis.com \
  tasks.googleapis.com

# ── GCS Bucket ────────────────────────────────────────────────
echo "▶ Creating GCS bucket: $BUCKET"
gsutil mb -l "$REGION" "gs://$BUCKET" || echo "Bucket already exists"

# ── Seed allowed users config ─────────────────────────────────
echo "▶ Seeding allowed users config..."
echo '{"users":[]}' | gsutil cp - "gs://$BUCKET/config/allowed-users.json"

# ── Firestore (Native mode) ───────────────────────────────────
echo "▶ Creating Firestore database..."
gcloud firestore databases create \
  --location="$REGION" \
  --type=firestore-native 2>/dev/null || echo "Firestore already exists"

# ── Pub/Sub topic ─────────────────────────────────────────────
echo "▶ Creating Pub/Sub topic: classcharts-poll"
gcloud pubsub topics create classcharts-poll || echo "Topic already exists"

# ── Cloud Scheduler ───────────────────────────────────────────
echo "▶ Creating Cloud Scheduler job (every 5 mins)..."
gcloud scheduler jobs create pubsub classcharts-poller \
  --location="$REGION" \
  --schedule="*/5 * * * *" \
  --topic=classcharts-poll \
  --message-body='{"trigger":"scheduled"}' \
  --description="Triggers ClassCharts poller every 5 minutes" \
  2>/dev/null || echo "Scheduler job already exists"

# ── Service Account for Cloud Run ────────────────────────────
echo "▶ Creating service account for poller..."
SA_NAME="classcharts-poller-sa"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SA_NAME" \
  --display-name="ClassCharts Poller" 2>/dev/null || echo "SA already exists"

# Grant necessary roles
for ROLE in \
  roles/datastore.user \
  roles/storage.objectAdmin \
  roles/pubsub.subscriber; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" --quiet
done

echo ""
echo "✅ GCP setup complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy poller: cd .. && gcloud run deploy classcharts-poller --source . --file Dockerfile.poller --region $REGION --service-account $SA_EMAIL"
echo "  2. Create Pub/Sub push subscription pointing to your Cloud Run URL"
echo "  3. Deploy frontend: cd frontend && gcloud app deploy"
echo "  4. Set env vars/secrets via Secret Manager"

# ── 3pm Homework Digest Scheduler ─────────────────────────────
echo "▶ Creating 3pm homework digest scheduler job..."
gcloud scheduler jobs create pubsub classcharts-digest \
  --location="$REGION" \
  --schedule="0 15 * * 1-5" \
  --topic=classcharts-poll \
  --message-body='{"trigger":"digest"}' \
  --time-zone="Europe/London" \
  --description="Sends homework digest at 3pm weekdays" \
  2>/dev/null || gcloud scheduler jobs update pubsub classcharts-digest \
  --location="$REGION" \
  --schedule="0 15 * * 1-5" \
  --topic=classcharts-poll \
  --message-body='{"trigger":"digest"}' \
  --time-zone="Europe/London" \
  2>/dev/null || echo "Digest scheduler job already up to date"

# ── Firestore indexes ──────────────────────────────────────────
echo "▶ Creating Firestore composite indexes..."
# announcements: studentId + timestamp
gcloud firestore indexes composite create \
  --collection-group=announcements \
  --field-config=field-path=studentId,order=ascending \
  --field-config=field-path=timestamp,order=descending \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  announcements index already exists"

# upcoming_events: studentId + date
gcloud firestore indexes composite create \
  --collection-group=upcoming_events \
  --field-config=field-path=studentId,order=ascending \
  --field-config=field-path=date,order=ascending \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  upcoming_events index already exists"

# ── Firestore Indexes ─────────────────────────────────────────
echo "▶ Deploying Firestore indexes..."
gcloud firestore indexes composite create \
  --collection-group=announcements \
  --field-config=field-path=studentId,order=ascending \
  --field-config=field-path=timestamp,order=descending \
  --project="$PROJECT_ID" --quiet 2>/dev/null || echo "  announcements index already exists"

gcloud firestore indexes composite create \
  --collection-group=attachments \
  --field-config=field-path=studentId,order=ascending \
  --field-config=field-path=announcementDate,order=descending \
  --project="$PROJECT_ID" --quiet 2>/dev/null || echo "  attachments index already exists"
