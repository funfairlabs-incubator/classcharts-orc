# ClassCharts ORC

A parent-facing dashboard for ClassCharts school data, with real-time polling, push notifications (OneSignal + Pushover), Google Calendar/Tasks integration, and AI-powered announcement summaries.

**Live:** [classcharts.funfairlabs.com](https://classcharts.funfairlabs.com)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                     │
│                                                                  │
│  Cloud Scheduler ──► Pub/Sub (classcharts-poll) ──► Cloud Run   │
│   (*/5 min + 3pm)                                      (Poller)  │
│                                                           │      │
│                                        ┌──────────────────┤      │
│                                        ▼          ▼       ▼      │
│                                   Firestore     GCS    Calendar  │
│                                        │                         │
│  App Engine (Next.js) ◄────────────────┘                         │
│  classcharts.funfairlabs.com                                     │
└─────────────────────────────────────────────────────────────────┘
                                              │
                                      OneSignal / Pushover
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
2. **Cloud Run Poller** wakes, logs into ClassCharts via TES SSO
3. Poller checks for new: announcements, homework, behaviour points, attendance, detentions
4. New items archived to **Firestore** + announcement/homework attachments downloaded to **GCS**
5. **OneSignal** push notifications sent to registered PWA devices; **Pushover** also fires if enabled
6. **Google Calendar** events created for homework and announcements
7. **Google Tasks** created for new homework
8. **Subject map** built from timetable lesson codes → subject names, cached in GCS
9. **Frontend** reads from Firestore + GCS, served at custom domain

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
                    │
          Re-grants Pub/Sub IAM binding
          (roles/run.invoker — drops on every deploy)
```

- **`dev`** — all active development, default branch
- **`main`** — production only, protected, deploys via GitHub Actions on merge

---

## Poller Detail

```
Cloud Run container (node:20-alpine + LibreOffice)
│
├── src/index.ts       — Express HTTP server (receives Pub/Sub push)
├── src/poller.ts      — main poll loop
├── src/archive.ts     — download attachments → GCS (announcements + homework)
├── src/calendar.ts    — Google Calendar event management
├── src/tasks.ts       — Google Tasks management
├── src/claude.ts      — Anthropic API for announcement summarisation
├── src/formatter.ts   — notification message formatting
├── src/notify.ts      — unified dispatch: OneSignal REST API + optional Pushover
├── src/digest.ts      — 3pm weekday homework digest
├── src/prefs.ts       — reads user-prefs.json (toggles, OneSignal IDs)
└── src/state.ts       — Firestore poll state + subject map GCS helpers
```

**Key behaviours:**
- Poll state stored per-student in Firestore (`poll_state/{studentId}`)
- Announcement detection uses `seenAnnouncementIds` set to prevent re-notification after deploy gaps
- `roles/run.invoker` IAM re-granted after every deploy (`infra/deploy-poller.sh`)
- LibreOffice converts `.docx`/`.pptx`/`.xlsx` → PDF before GCS save
- Subject map built each poll from timetable (`Ma` → `Mathematics`), saved to `config/subject-map.json`
- Homework attachments saved to `homework/{studentId}/{homeworkId}/{filename}`

**Notification channels (admin-toggled in /settings → Notification Channels):**
- **OneSignal** — rich web push to installed PWAs; subscription IDs in `user-prefs.json`
- **Pushover** — fallback; can be disabled once OneSignal validated on all devices

**TES SSO (April 2026):** ClassCharts migrated auth through `session.tes.com`. Standard `classcharts-api` hits a redirect loop. `shared/src/classcharts.ts` bypasses with a manual TES handshake.

---

## Frontend Detail

```
App Engine (nodejs22, F1 instance)
│
├── src/app/
│   ├── day/                        — Day View (timetable + attendance)
│   ├── homework/                   — homework list; 📎 Documents link when attachments exist
│   ├── behaviour/                  — behaviour points
│   ├── attendance/                 — attendance records
│   ├── announcements/              — announcements with AI summaries
│   ├── documents/                  — announcement + homework attachments, filter by student/type
│   ├── settings/                   — notification prefs, colour themes, channel toggles (admin)
│   ├── status/                     — poller health + dependency status
│   ├── architecture/               — interactive system diagram
│   └── api/
│       ├── attachments/[...path]/  — GCS proxy (announcements/ + homework/ prefixes)
│       ├── documents/              — merged attachment metadata from both Firestore collections
│       ├── subject-map/            — lesson code → subject name (from GCS)
│       ├── onesignal-id/           — register/remove OneSignal subscription IDs
│       ├── settings/prefs/         — notification toggles per user
│       ├── settings/channels/      — global channel on/off (admin)
│       ├── test-notification/      — send test via all enabled channels
│       └── timetable/              — ClassCharts timetable data
├── src/lib/onesignal.ts            — OneSignal SDK helper
└── src/middleware.ts               — rewrites x-forwarded-host for App Engine
```

**Auth notes:**
- `NEXT_PUBLIC_*` vars baked into client bundle at build time — deploy script writes `.env.production` before `gcloud app deploy`
- `frontend/app.yaml` is gitignored — generated at deploy time from Secret Manager values
- OAuth redirect URI: `https://classcharts.funfairlabs.com/api/auth/callback/google`

---

## Infrastructure

### GCP Project: `classcharts` (306745837103) · Firebase: `classcharts-5bf9a`

| Service | Purpose |
|---------|---------|
| App Engine | Frontend hosting |
| Cloud Run | Poller (`classcharts-poller`, europe-west2) |
| Cloud Build | Docker image builds |
| Pub/Sub | Poll trigger (`classcharts-poll`) |
| Cloud Scheduler | `*/5 * * * *` poll + `0 15 * * 1-5` digest |
| Firestore | Poll state, announcements, attachments, homeworkAttachments |
| GCS | Files + config (`classcharts-attachments`) |
| Secret Manager | All credentials |
| OneSignal | Push notifications (external) |

### GCS Bucket: `classcharts-attachments`

| Path | Contents |
|------|---------|
| `config/allowed-users.json` | Permitted Google accounts |
| `config/user-prefs.json` | Per-user notification toggles + OneSignal IDs + channel flags |
| `config/subject-map.json` | Lesson code → subject name |
| `attachments/{studentId}/{announcementId}/{filename}` | Announcement files |
| `homework/{studentId}/{homeworkId}/{filename}` | Homework files |

### Known GCP Gotchas

- **Pub/Sub IAM drops on redeploy** — `deploy-poller.sh` re-grants `roles/run.invoker` automatically
- **No `getSignedUrl` on App Engine SA** — proxy streams directly from GCS
- **`NEXT_PUBLIC_*` needs build-time injection** — App Engine `env_variables` are server-only; deploy script writes `.env.production`
- **Firebase project ID ≠ GCP project ID** — `classcharts-5bf9a` (Firebase) vs `classcharts` (GCP)

---

## Secrets (GCP Secret Manager)

| Secret | Used by |
|--------|---------|
| `CLASSCHARTS_PARENT1_EMAIL` | Poller + Frontend |
| `CLASSCHARTS_PARENT1_PASSWORD` | Poller + Frontend |
| `GOOGLE_CLIENT_ID` | Frontend OAuth |
| `GOOGLE_CLIENT_SECRET` | Frontend OAuth |
| `NEXTAUTH_SECRET` | Frontend session |
| `NEXTAUTH_URL` | Frontend |
| `GCAL_REFRESH_TOKEN` | Poller (Calendar + Tasks) |
| `ANTHROPIC_API_KEY` | Poller (AI summaries) |
| `PUSHOVER_API_TOKEN` | Poller (optional) |
| `PUSHOVER_USER_KEY` | Poller (optional) |
| `PUSHOVER_ENABLED` | Poller — `true`/`false`, runtime, no redeploy needed |
| `ONESIGNAL_APP_ID` | Poller + Frontend (NEXT_PUBLIC) |
| `ONESIGNAL_API_KEY` | Poller + Frontend |
| `ADMIN_EMAIL` | Frontend (NEXT_PUBLIC) — controls admin-only Settings sections |
| `WEBHOOK_SECRET` | Poller |

---

## OneSignal Setup

**Registration:** Each parent visits `/settings` → **Enable notifications on this device**. OneSignal SDK requests permission, creates a subscription, POSTs the ID to `/api/onesignal-id` → stored in `config/user-prefs.json`.

**Channel toggles:** `/settings` → **Notification Channels** (admin only):
- **OneSignal** — on by default
- **Pushover** — on by default, disable once OneSignal validated on all devices

**Service worker:** `public/OneSignalSDKWorker.js` served from root domain imports the real worker from the OneSignal CDN. Pi-hole must whitelist `cdn.onesignal.com` and `onesignal.com`.

---

## Deploy Manually

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

- **Status page:** [classcharts.funfairlabs.com/status](https://classcharts.funfairlabs.com/status)
- **Architecture:** [classcharts.funfairlabs.com/architecture](https://classcharts.funfairlabs.com/architecture)
- **Cloud Run logs:** `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="classcharts-poller"' --project=classcharts --freshness=30m --format='value(timestamp,textPayload)' | grep -v "^$"`
- **App Engine logs:** `gcloud app logs tail --project=classcharts`

---

## Backfill Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `backfill-homework-attachments.ts` | Download homework attachments for existing homework |
| `backfill-attachments.ts` | Download announcement attachments |
| `backfill-calendar.ts` | Create calendar events for existing announcements |
| `backfill-homework-calendar.ts` | Create calendar events for existing homework |
| `backfill-homework-tasks.ts` | Create Google Tasks for existing homework |
| `reset-announcement-state.ts` | Reset seen announcement IDs |
| `trigger-poll.sh` | Manually trigger a poll via Pub/Sub |

---

## FunFairLabs Ecosystem

| App | URL | Repo | Stack |
|-----|-----|------|-------|
| ClassCharts ORC | [classcharts.funfairlabs.com](https://classcharts.funfairlabs.com) | `classcharts-orc` | Next.js + Cloud Run |
| Learning Platform | [learn.funfairlabs.com](https://learn.funfairlabs.com) | `learning-monkey-switch` | GitHub Pages + CF Worker |
| Expense Tracker | [expenses.funfairlabs.com](https://expenses.funfairlabs.com) | `expend-a-bot` | CF Pages + Worker |
| Toolbox | [toolbox.funfairlabs.com](https://toolbox.funfairlabs.com) | `toolbox` | CF Pages |
| Home | [funfairlabs.com](https://funfairlabs.com) | `thefunfairgates` | GitHub Pages |
