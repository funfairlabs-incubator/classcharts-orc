# ClassCharts ORC

A parent-facing dashboard for ClassCharts school data, with real-time polling, push notifications, Google Calendar/Tasks integration, and AI-powered announcement summaries.

**Live:** [classcharts.funfairlabs.com](https://classcharts.funfairlabs.com)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                     │
│                                                                  │
│  Cloud Scheduler ──► Pub/Sub (classcharts-poll) ──► Cloud Run   │
│       (*/5 min)                                        (Poller)  │
│                                                           │      │
│                                        ┌──────────────────┤      │
│                                        ▼          ▼       ▼      │
│                                   Firestore     GCS    Calendar  │
│                                        │                         │
│  App Engine (Next.js) ◄────────────────┘                         │
│  classcharts.funfairlabs.com                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Location |
|-----------|-----------|---------|
| **Frontend** | Next.js 14 + NextAuth | `frontend/` → App Engine |
| **Poller** | Node.js + TypeScript | `poller/` → Cloud Run |
| **Shared** | TypeScript types + ClassCharts client | `shared/` |
| **Infra scripts** | bash + gcloud | `infra/` |

### Data Flow

1. **Cloud Scheduler** triggers every 5 minutes via Pub/Sub message
2. **Cloud Run Poller** wakes, logs into ClassCharts via parent credentials
3. Poller checks for new: announcements, homework, behaviour points, attendance
4. New items are archived to **Firestore** + attachments to **GCS**
5. **Firebase Cloud Messaging (FCM)** push notifications sent immediately for new items
6. **Google Calendar** events created for homework (issue date) and announcements
7. **Google Tasks** created for new homework
8. **Frontend** (Next.js on App Engine) reads from Firestore + GCS, served at custom domain

---

## CI/CD

```
Developer ──► dev branch ──► PR ──► main branch
                                        │
                              GitHub Actions detects changed paths
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
          poller/** or shared/**                  frontend/** or shared/**
                    │                                       │
          deploy-poller.yml                      deploy-frontend.yml
                    │                                       │
          gcloud builds submit                   gcloud app deploy
          (Cloud Build → Docker)                 (App Engine)
                    │                                       │
          Cloud Run revision                    App Engine version
          (europe-west2)                        (classcharts project)
                    │
          Re-grants Pub/Sub IAM binding
          (roles/run.invoker — drops on every deploy)
```

### Branch Strategy

- **`dev`** — all active development, default branch
- **`main`** — production only, protected, deploys via GitHub Actions on merge

### Path-based Deploy Triggers

| Changed files | Workflow triggered |
|--------------|-------------------|
| `poller/**`, `shared/**`, `Dockerfile.poller` | Deploy Poller |
| `frontend/**`, `shared/**` | Deploy Frontend |
| Both | Both workflows run in parallel |

---

## Poller Detail

```
Cloud Run container (node:20-alpine + LibreOffice)
│
├── src/poller.ts      — main poll loop
├── src/archive.ts     — download attachments → GCS, docx→PDF via LibreOffice
├── src/calendar.ts    — Google Calendar event management
├── src/tasks.ts       — Google Tasks management
├── src/claude.ts      — Anthropic API for announcement summarisation
├── src/formatter.ts   — notification message formatting
├── src/notify.ts      — unified FCM + Pushover dispatch (parallel-run); FCM-only post-cutover
├── src/state.ts       — Firestore poll state (per student)
└── src/index.ts       — Express HTTP server (receives Pub/Sub push)
```

**Key behaviours:**
- Poll state stored per-student in Firestore (`poll_state/{studentId}`)
- Announcement detection uses `seenAnnouncementIds` set (not just max ID) to prevent gaps
- `roles/run.invoker` IAM binding re-granted after every deploy (Cloud Run resets it)
- LibreOffice in Docker image converts `.docx`/`.pptx`/`.xlsx` → PDF before GCS save

**TES SSO (April 2026):** ClassCharts migrated auth through TES (`session.tes.com`). The standard `classcharts-api` library hits a redirect loop. Our `shared/src/classcharts.ts` bypasses this with a manual TES handshake — see `ClassChartsParentClient.login()`.

---

## Frontend Detail

```
App Engine (nodejs22, F1 instance)
│
├── src/app/
│   ├── page.tsx              — dashboard (behaviour, homework, timetable)
│   ├── announcements/        — announcement list with AI summaries
│   ├── documents/            — homework documents
│   ├── settings/             — accent colour picker, user preferences
│   └── api/
│       ├── pupils/           — ClassCharts pupil data
│       ├── attachments/      — GCS attachment proxy (streams, no signed URLs)
│       ├── auth/             — NextAuth Google OAuth
│       └── debug-headers/    — header inspection (dev)
├── src/lib/auth.ts           — NextAuth config with TES-aware middleware
└── src/middleware.ts         — rewrites x-forwarded-host (App Engine → custom domain)
```

**Auth notes:**
- App Engine internally routes via `*.appspot.com` even on custom domains
- `middleware.ts` rewrites `x-forwarded-host` to `classcharts.funfairlabs.com` on every request
- `frontend/app.yaml` is gitignored — generated at deploy time by `infra/deploy-frontend.sh`
- OAuth redirect URI hardcoded to `https://classcharts.funfairlabs.com/api/auth/callback/google`

---

## Infrastructure

### GCP Project: `classcharts` (project number: 306745837103)

| Service | Purpose |
|---------|---------|
| App Engine | Frontend hosting |
| Cloud Run | Poller container |
| Cloud Build | Docker image builds |
| Pub/Sub | Poll trigger (topic: `classcharts-poll`) |
| Cloud Scheduler | Fires Pub/Sub every 5 min |
| Firestore | Poll state + archived announcements |
| GCS | Attachment storage (`classcharts-attachments`) |
| Secret Manager | All credentials |
| Firebase Cloud Messaging | Push notifications to parent PWAs |

### Service Accounts

| Account | Used for |
|---------|---------|
| `classcharts@appspot.gserviceaccount.com` | App Engine default |
| `classcharts-poller-sa@classcharts.iam.gserviceaccount.com` | Pub/Sub → Cloud Run auth |
| `github-actions@classcharts.iam.gserviceaccount.com` | CI/CD deploys |

### Known GCP Gotchas

- **Pub/Sub IAM drops on redeploy** — `roles/run.invoker` on `classcharts-poller-sa` must be re-granted after every `gcloud run deploy`. `infra/deploy-poller.sh` does this automatically.
- **No `getSignedUrl` on App Engine SA** — attachment proxy streams directly from GCS instead.
- **`NEXTAUTH_URL` must be in generated `app.yaml`** — App Engine does not read `.env`.
- **GitHub Actions cannot stream Cloud Build logs** — the deploy still succeeds; add `roles/logging.viewer` to `github-actions` SA to fix.

---

## Pushover → FCM Transition

Push notifications are migrating from Pushover to Firebase Cloud Messaging (FCM). During the transition both channels run in parallel.

**To add new secrets (one-time setup):**
1. Get Firebase config from [Firebase Console → Project Settings → General → Your apps](https://console.firebase.google.com)
2. Get VAPID key from Firebase Console → Cloud Messaging → Web Push certificates → Generate key pair
3. Add values to your local `.env` file
4. Run `cd infra && ./load-secrets.sh ../.env` to push to Secret Manager
5. Merge the PR — GitHub Actions deploys both poller and frontend

**FCM token registration:**  
Each parent visits `/settings` and taps **Enable notifications on this device**. This registers an FCM token stored per-user in `config/user-prefs.json` in GCS.

**Cutover:**  
After a week of parallel running, set `PUSHOVER_ENABLED=false` in Secret Manager (no redeploy needed — poller reads it at runtime). The Pushover dependency will show as `–` (disabled) on the status page rather than red. Then remove `PUSHOVER_API_TOKEN` and `PUSHOVER_USER_KEY` secrets on the next PR.

---

## Local Development

```bash
# Install dependencies
cd shared && npm install
cd ../frontend && npm install
cd ../poller && npm install

# Copy env
cp .env.example .env  # fill in credentials

# Run frontend
cd frontend && npm run dev  # http://localhost:3000

# Run poller locally
cd poller && npm run dev
```

### Secrets (all in GCP Secret Manager)

| Secret | Used by |
|--------|---------|
| `CLASSCHARTS_PARENT1_EMAIL` | Poller + Frontend |
| `CLASSCHARTS_PARENT1_PASSWORD` | Poller + Frontend |
| `GOOGLE_CLIENT_ID` | Frontend OAuth |
| `GOOGLE_CLIENT_SECRET` | Frontend OAuth |
| `NEXTAUTH_SECRET` | Frontend session |
| `NEXTAUTH_URL` | Frontend |
| `GCAL_REFRESH_TOKEN` | Poller (Calendar + Tasks) |
| `ANTHROPIC_API_KEY` | Poller (announcement AI) |
| `PUSHOVER_API_TOKEN` | Poller (parallel-run only — remove after FCM cutover) |
| `PUSHOVER_USER_KEY` | Poller (parallel-run only — remove after FCM cutover) |
| `PUSHOVER_ENABLED` | Poller (`true` during parallel run, `false` to cut over to FCM-only) |
| `FIREBASE_API_KEY` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_AUTH_DOMAIN` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_PROJECT_ID` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_STORAGE_BUCKET` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_MESSAGING_SENDER_ID` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_APP_ID` | Frontend (NEXT_PUBLIC) |
| `FIREBASE_VAPID_KEY` | Frontend — FCM web push certificate key pair |
| `ADMIN_EMAIL` | Frontend |
| `WEBHOOK_SECRET` | Poller |

---

## Deploy Manually (if Actions fails)

```bash
# Poller
cd ~/classcharts-orc && infra/deploy-poller.sh

# Frontend
cd ~/classcharts-orc && infra/deploy-frontend.sh

# Fix Pub/Sub IAM if polls are 403ing
gcloud run services add-iam-policy-binding classcharts-poller \
  --region=europe-west2 \
  --member="serviceAccount:classcharts-poller-sa@classcharts.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=classcharts
```

---

## Monitoring

- **UptimeRobot:** [stats.uptimerobot.com/AZX3m7HE4p](https://stats.uptimerobot.com/AZX3m7HE4p)
- **Cloud Run logs:** `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="classcharts-poller"' --project=classcharts --limit=50 --format='value(timestamp,textPayload)' --freshness=1h | grep -v "^$"`
- **App Engine logs:** `gcloud app logs tail --project=classcharts`

---

## FunFairLabs Ecosystem

| App | URL | Repo | Stack |
|-----|-----|------|-------|
| ClassCharts ORC | [classcharts.funfairlabs.com](https://classcharts.funfairlabs.com) | `classcharts-orc` | Next.js + Cloud Run |
| Learning Platform | [learn.funfairlabs.com](https://learn.funfairlabs.com) | `learning-monkey-switch` | GitHub Pages + CF Worker |
| Expense Tracker | [expenses.funfairlabs.com](https://expenses.funfairlabs.com) | `expend-a-bot` | CF Pages + Worker |
| Toolbox | [toolbox.funfairlabs.com](https://toolbox.funfairlabs.com) | `toolbox` | CF Pages (IT-Tools + CyberChef) |
| Home | [funfairlabs.com](https://funfairlabs.com) | `thefunfairgates` | GitHub Pages |
