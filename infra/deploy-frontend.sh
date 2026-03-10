#!/usr/bin/env bash
# Deploy frontend to App Engine with secrets injected into app.yaml
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

echo "▶ Building shared package..."
cd "$REPO_ROOT/shared"
npm install
npm run build

echo "▶ Copying shared into frontend for App Engine deploy..."
rm -rf "$REPO_ROOT/frontend/vendor/shared"
mkdir -p "$REPO_ROOT/frontend/vendor/shared"
cp -r "$REPO_ROOT/shared/dist"         "$REPO_ROOT/frontend/vendor/shared/dist"
cp    "$REPO_ROOT/shared/package.json"  "$REPO_ROOT/frontend/vendor/shared/package.json"
# Copy shared node_modules too so classcharts-api is available
cp -r "$REPO_ROOT/shared/node_modules" "$REPO_ROOT/frontend/vendor/shared/node_modules"

echo "▶ Updating frontend package.json to point at vendored shared..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$REPO_ROOT/frontend/package.json'));
pkg.dependencies['@classcharts/shared'] = 'file:./vendor/shared';
pkg.scripts['gcp-build'] = 'next build';
fs.writeFileSync('$REPO_ROOT/frontend/package.json', JSON.stringify(pkg, null, 2));
"

echo "▶ Writing app.yaml with secrets..."
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
beta_settings:
  cloud_build_timeout: "900"
YAML

echo "▶ Deploying to App Engine..."
cd "$REPO_ROOT/frontend"
gcloud app deploy --quiet --project="$PROJECT_ID"

echo "✅ Frontend deployed to https://${PROJECT_ID}.appspot.com"
