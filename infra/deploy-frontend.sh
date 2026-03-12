#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-classcharts}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fetch_secret() {
  gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID" 2>/dev/null || echo ""
}

echo "▶ Fetching secrets..."
GOOGLE_CLIENT_ID=$(fetch_secret GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(fetch_secret GOOGLE_CLIENT_SECRET)
NEXTAUTH_SECRET=$(fetch_secret NEXTAUTH_SECRET)
ADMIN_EMAIL=$(fetch_secret ADMIN_EMAIL)
CC_EMAIL=$(fetch_secret CLASSCHARTS_PARENT1_EMAIL)
CC_PASSWORD=$(fetch_secret CLASSCHARTS_PARENT1_PASSWORD)
PUSHOVER_API_TOKEN=$(fetch_secret PUSHOVER_API_TOKEN)
PUSHOVER_USER_KEY=$(fetch_secret PUSHOVER_USER_KEY)

echo "▶ Building shared package..."
cd "$REPO_ROOT/shared"
npm install
npm run build

echo "▶ Copying shared into frontend for App Engine deploy..."
rm -rf "$REPO_ROOT/frontend/vendor/shared"
mkdir -p "$REPO_ROOT/frontend/vendor/shared"
cp -r "$REPO_ROOT/shared/dist"         "$REPO_ROOT/frontend/vendor/shared/dist"
cp    "$REPO_ROOT/shared/package.json"  "$REPO_ROOT/frontend/vendor/shared/package.json"
cp -r "$REPO_ROOT/shared/node_modules" "$REPO_ROOT/frontend/vendor/shared/node_modules"

echo "▶ Updating frontend package.json to point at vendored shared..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$REPO_ROOT/frontend/package.json'));
pkg.dependencies['@classcharts/shared'] = 'file:./vendor/shared';
pkg.scripts['gcp-build'] = 'cd vendor/shared && npm install --production && cd ../.. && next build';
fs.writeFileSync('$REPO_ROOT/frontend/package.json', JSON.stringify(pkg, null, 2));
"

echo "▶ Writing app.yaml with secrets..."
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)" --project="$PROJECT_ID" 2>/dev/null | cut -c1-7 || echo "local")
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DEPLOYED_AT=$(date -u +"%d/%m/%Y %H:%M:%S GMT")

cat > "$REPO_ROOT/frontend/app.yaml" << YAML
runtime: nodejs22
instance_class: F1
automatic_scaling:
  min_idle_instances: 0
  max_idle_instances: 1
  max_instances: 2
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
  CLASSCHARTS_PARENT1_EMAIL: "${CC_EMAIL}"
  CLASSCHARTS_PARENT1_PASSWORD: "${CC_PASSWORD}"
  PUSHOVER_API_TOKEN: "${PUSHOVER_API_TOKEN}"
  PUSHOVER_USER_KEY: "${PUSHOVER_USER_KEY}"
  NEXT_PUBLIC_BUILD_ID: "${BUILD_ID}"
  NEXT_PUBLIC_COMMIT_SHA: "${COMMIT_SHA}"
  NEXT_PUBLIC_DEPLOYED_AT: "${DEPLOYED_AT}"
beta_settings:
  cloud_build_timeout: "900"
YAML

echo "▶ Deploying to App Engine..."
cd "$REPO_ROOT/frontend"
gcloud app deploy --quiet --project="$PROJECT_ID"

echo "✅ Frontend deployed to https://${PROJECT_ID}.appspot.com"
