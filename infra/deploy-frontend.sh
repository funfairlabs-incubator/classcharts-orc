#!/usr/bin/env bash
# Deploy frontend to App Engine with secrets injected into app.yaml
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"
REGION="${GCP_REGION:-europe-west2}"

fetch_secret() {
  gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID" 2>/dev/null || echo ""
}

echo "▶ Fetching secrets..."
GOOGLE_CLIENT_ID=$(fetch_secret GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(fetch_secret GOOGLE_CLIENT_SECRET)
NEXTAUTH_SECRET=$(fetch_secret NEXTAUTH_SECRET)
ADMIN_EMAIL=$(fetch_secret ADMIN_EMAIL)

echo "▶ Writing app.yaml with secrets..."
cat > "$(dirname "$0")/../frontend/app.yaml" << YAML
runtime: nodejs22
instance_class: F1
automatic_scaling:
  min_idle_instances: 0
  max_idle_instances: 1
env_variables:
  NODE_ENV: "production"
  GCP_PROJECT_ID: "${PROJECT_ID}"
  GCS_BUCKET: "classcharts-attachments"
  GCS_ALLOWED_USERS_PATH: "config/allowed-users.json"
  NEXTAUTH_URL: "https://${PROJECT_ID}.appspot.com"
  GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
  GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET}"
  NEXTAUTH_SECRET: "${NEXTAUTH_SECRET}"
  ADMIN_EMAIL: "${ADMIN_EMAIL}"
beta_settings:
  cloud_build_timeout: "900"
YAML

echo "▶ Deploying to App Engine..."
cd "$(dirname "$0")/../frontend"
gcloud app deploy --quiet --project="$PROJECT_ID"

echo "✅ Frontend deployed to https://${PROJECT_ID}.appspot.com"
