# Crestron Custom Scheduling Panel (TSS-1070)

A fully custom HTML5 room-scheduling panel that replaces the stock Crestron
scheduling app on TSS-x70 touchscreens — built with Svelte 5, a swappable
schedule-data backend, and deployed through the panel's **"Crestron general
web application"** kiosk mode.

> 📖 **Want to build one of these yourself?** The complete step-by-step
> instructional guide — from panel discovery to kiosk deployment — is in
> [`docs/BUILD-GUIDE.md`](docs/BUILD-GUIDE.md).

## Why this exists

Crestron scheduling panels (TSS-770/1070) run a fixed set of selectable apps.
The stock Crestron room scheduling app is capable but **not modifiable** — the
only way to get a truly custom UI/UX is the "Crestron general web application"
mode, which turns the panel into an HTTPS kiosk pointed at a web app you host.
This project is that web app, plus the backend that feeds it.

## Architecture

```
┌─────────────────────────────┐
│  TSS-1070 touch panel       │   kiosk mode: "Crestron general web application"
│  (Chromium kiosk, HTTPS)    │   Settings > Applications > Application Mode
└──────────────┬──────────────┘
               │ HTTPS
┌──────────────▼──────────────┐
│  scheduling-backend (Node)  │   one process serves BOTH:
│  ├── static: panel dist/    │   • the built Svelte panel app
│  └── API: /api/*            │   • the schedule API
│        │                    │
│        ├── memory provider  │   demo mode — zero credentials, zero cost
│        └── google provider  │   Google Calendar API v3 (service account, free)
└─────────────────────────────┘
```

The panel app and backend share one contract — `ScheduleProvider`
(`getRoomState / reserveNow / endCurrent / extendCurrent / checkIn`) — defined
in both `scheduling-panel/src/lib/data/types.ts` and
`scheduling-backend/src/types.ts`. Any new data source (Exchange, Fusion, a
booking SaaS) is one file implementing that interface.

## Repo layout

| Path | What it is |
|---|---|
| `scheduling-panel/` | Svelte 5 + Vite 6 CH5 panel app (from the ch5-svelte-v2 template) |
| `scheduling-panel/src/lib/data/` | `ScheduleProvider` contract, mock provider, HTTP provider |
| `scheduling-panel/src/lib/stores/schedule.ts` | provider → Svelte stores pipeline |
| `scheduling-backend/` | Node 20 backend: API + static hosting + optional TLS |
| `scheduling-backend/src/googleProvider.ts` | Google Calendar API v3 implementation |
| `docs/BUILD-GUIDE.md` | **The instructional guide: build this from scratch** |
| `CLAUDE.md` / `.fred.json` | AI-assistant project context (FRED/Archon task system) |

## Quick start (demo — no hardware, no Google, no cost)

```bash
# 1. Build the panel app
cd scheduling-panel
npm install
npm run build

# 2. Build + run the backend in memory mode, serving the panel
cd ../scheduling-backend
npm install
npm run build
PROVIDER=memory STATIC_DIR=../scheduling-panel/dist PORT=8080 npm start
```

Open **http://localhost:8080**. You get a seeded business day: a meeting in
progress, a free gap, upcoming meetings. Reserve / End / Extend / Check-In all
round-trip through the backend. Open it in two windows — changes in one appear
in the other within ~10 s (the panel polls).

The served `dist/config.json` selects the data source **at runtime** (no
rebuild): `"schedule": {"source": "http"}` uses the backend;
`"source": "mock"` uses the in-browser mock (pure front-end dev).

## Panel deployment (the short version)

1. Host the backend with **HTTPS** — the TSS kiosk mode refuses plain HTTP.
   Public-CA certs are trusted out of the box; self-signed needs a cert
   install on the panel.
2. Panel web config → **Settings > Applications > Application Mode →
   "Crestron General Web Application"** → set the URL → panel reboots into
   kiosk mode.
3. Rollback any time: switch the mode back and the stock app re-downloads.

Full detail, including probing the panel REST API and what the stock app does
(the parity checklist), is in the [build guide](docs/BUILD-GUIDE.md).

## Google Calendar mode (optional, free)

The Calendar API has no billing — a service account + one shared calendar
gives the demo real calendar sync. Steps in
[`scheduling-backend/README.md`](scheduling-backend/README.md). Activate with:

```bash
PROVIDER=google GOOGLE_CALENDAR_ID=<id> GOOGLE_SA_KEY_FILE=./service-account.json npm start
```

## Bench hardware reference

| Item | Value |
|---|---|
| Panel | TSS-1070, firmware [REDACTED] |
| App mode (as shipped) | OOTB — no app selected |
| Custom mode key | `Device/ThirdPartyApplications/Mode` = `"CrestronGeneralWeb"` |
| Kiosk URL constraint | HTTPS only |

## Status / roadmap

- [x] Panel app with mock day, all booking actions, TSS-770/1070 preview modes
- [x] Backend (memory + Google providers), static hosting, TLS support
- [x] Panel kiosk mode verified live against bench TSS-1070
- [ ] Self-signed cert + install on panel → demo on real glass
- [ ] Stock-app parity: check-in enforcement windows, no-show auto-release
- [ ] Light bar control via panel REST (`LedControl`) from the backend
- [ ] Privacy levels, themes, configurable booking rules
