# ClassCharts ORC — To-Do

## 🔴 Security — High Priority

- [x] **Delete `/api/debug-headers`** — unauthenticated route exposes all request headers including cookies, auth tokens and internal GCP headers. No legitimate use in production.

- [x] **Attachment path traversal** — `/api/attachments/[...path]` joins params with no sanitisation. A crafted request to `../config/allowed-users.json` could read any GCS file in the bucket. Fix: validate path starts with `attachments/`.

## 🟡 Security — Medium Priority

- [ ] **Middleware doesn't enforce auth** — `middleware.ts` only rewrites headers. Individual `if (!session)` checks are the only gate. If one API route is missing the check it is publicly accessible. Fix: add NextAuth middleware matcher as a second layer of defence.

- [ ] **ClassCharts credentials in `app.yaml` env vars** — plaintext in App Engine environment. Low risk (App Engine is locked down) but Secret Manager at runtime (as the poller does) would be cleaner.

- [ ] **Session cookie scoped to `.funfairlabs.com`** — valid across all subdomains. If any other subdomain were compromised it could read the ClassCharts session cookie. Consider scoping to `classcharts.funfairlabs.com` only.

## 🟠 Technical Debt

- [ ] **Dependabot vulnerabilities** — 18 open (2 critical `protobufjs`, 5 high Next.js). Run `npm audit fix` across shared/frontend/poller.

- [ ] **Raise `classcharts-api` TES SSO PR upstream** — our TES handshake fix in `shared/src/classcharts.ts` should be contributed back to the `classchartsapi/classcharts-api-js` repo.

- [ ] **ESLint `continue-on-error: true`** — currently warns but doesn't block deploy. Tighten to fail once existing warnings are resolved.

- [ ] **Attendance page** (`/attendance`) — still the old single-student view. Could get the same multi-student treatment as behaviour/homework.

- [ ] **Expend-a-Bot scan-pending** — endpoint committed but never deployed due to PAT expiry.

- [ ] **`funfairlabs.com` domain transfer to Cloudflare Registrar** — restore DDNS for home WireGuard VPN, reduce AWS/Squarespace dependency.

- [ ] **Tailscale evaluation** — potential replacement for WireGuard, eliminates DDNS and port-forwarding requirements.

## ✅ Resolved

- [x] TES SSO login fix (Apr 2026)
- [x] Pub/Sub IAM binding drop on redeploy — re-granted in deploy script
- [x] Pub/Sub push subscription OIDC token
- [x] Custom domain migration (appspot.com → classcharts.funfairlabs.com)
- [x] Build info (real SHA + timestamp in footer)
- [x] Poller heartbeat + status page + traffic light footer indicator
- [x] Multi-student support with demo mode
- [x] Day View (timetable + attendance combined)
- [x] Preflight TypeScript + ESLint + build checks
- [x] PWA install button in settings
