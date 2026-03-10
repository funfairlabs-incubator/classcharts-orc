# ClassCharts Parent Dashboard

A self-hosted parent dashboard for ClassCharts with Pushover notifications.

## Structure

```
classcharts-parent/
├── frontend/        # Next.js app — GAE deployment
├── poller/          # Cloud Run service — Pub/Sub triggered
├── shared/          # Shared types and ClassCharts API client
└── infra/           # GCP setup scripts and Terraform (optional)
```

## Quick Start

### Prerequisites
- Node.js 20+
- GCP project with billing enabled
- ClassCharts parent account(s)
- Pushover app + user keys
- Google OAuth credentials

### Setup
1. `cp .env.example .env` and fill in values
2. `cd shared && npm install && npm run build`
3. `cd frontend && npm install && npm run dev`
4. `cd poller && npm install`

## Environment Variables

See `.env.example` for all required variables.

## Deployment

- **Frontend**: `gcloud app deploy` from `frontend/`
- **Poller**: `gcloud run deploy` from `poller/`
- **Infra**: See `infra/setup.sh` for GCP resource creation
