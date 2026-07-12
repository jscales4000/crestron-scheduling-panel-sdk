# Build Guide: A Custom Crestron Scheduling Panel from Scratch

This is the instructional companion to this repo. It documents every step we
took to build a custom room-scheduling panel for a Crestron TSS-1070 — in the
order we took them — so you can reproduce the project (or build your own
variant) end to end. Each step names the exact files in this repo that
implement it.

**What you end up with:** a Svelte web app running full-screen on a Crestron
scheduling panel via its kiosk mode, backed by a small Node service that can
serve demo data or a real Google Calendar.

---

## Step 0 — Understand the platform before writing code

The single most important fact: **you cannot modify Crestron's stock
scheduling app.** TSS-x70 panels run one app at a time, chosen from a fixed
list in the web configuration (stock scheduler, ~25 partner apps, Teams,
Zoom… and one escape hatch):

> **"Crestron general web application"** — the panel becomes a full-screen
> HTTPS kiosk pointed at a URL you host.

That mode is the entire basis of this project. Two constraints come with it
(from Crestron doc 8745, confirmed on real hardware):

1. **The URL must be HTTPS.** The panel ships with a standard CA root store,
   so publicly-signed certs (Let's Encrypt etc.) work out of the box;
   self-signed certs must be installed into the panel's certificate store.
2. **No CrComLib joins in this mode.** A kiosk web app talks to *your*
   services, not to a control processor via joins. (If you need joins, you
   are building for a TSW panel with a loaded .ch5z project instead — a
   different architecture.)

### Know what you're replacing

Before designing, we extracted a feature baseline of the stock scheduling app
from Crestron's docs (8205/8745/8989). Highlights that shape any replacement:

- Ad-hoc "reserve now" with duration rules (5–480 min) and collision guards
- End-early and extend, gated by elapsed time
- Optional forced check-in with a no-show auto-release window
- Privacy levels (Public / Semi-Private / Private) controlling what details show
- Distinct Available / Reserved screens; light bar shows green/red room state
- Calendar sources: Fusion, Exchange/EWS, Microsoft Graph, Google, and others

Treat that list as your parity checklist. This repo implements the core
booking flows; the rest is roadmap.

---

## Step 1 — Probe the actual panel (don't trust assumptions)

Every claim above was verified against the bench panel before we committed to
the architecture. The TSS/TSW-x70 web configuration is backed by a REST API
you can drive with curl:

```bash
# Login: form POST issues session cookies + an XSRF token
curl -sk -c cookies.txt https://<panel-ip>/userlogin.html   # prime cookies
curl -sk -b cookies.txt -c cookies.txt -X POST https://<panel-ip>/userlogin.html \
     --data "login=admin&passwd=<password>"

# Read the whole device tree (~90 KB of JSON)
curl -sk -b cookies.txt https://<panel-ip>/Device > device.json
```

Three objects matter for this project:

| REST path | What it tells you |
|---|---|
| `Device/DeviceInfo` | model, firmware — confirm you actually have a TSS-x70 |
| `Device/ThirdPartyApplications` | `Mode` (current app; `"OOTB"` = never configured), `ApplicationsModeSupported` (look for `"CrestronGeneralWeb"`), `CrestronGeneralWeb.ServerUrl` |
| `Device/SchedulingPanel/Config` | the stock scheduler's entire config surface — useful for parity research |

If `ApplicationsModeSupported` contains `CrestronGeneralWeb`, the plan works.
Writes go to the same tree (POST with `X-CREST-XSRF-TOKEN` header), but do
the mode switch from the web config UI the first time.

---

## Step 2 — Scaffold the panel web app

Any modern front-end stack works in a kiosk browser. We used **Svelte 5 +
Vite 6** from an internal CH5 template (`scheduling-panel/` here). If you're
starting bare, the pieces that matter:

- A **base-resolution scaling shell**: design at 1280×800 and scale with a CSS
  variable so the same layout fills a 770 (1280×800) and a 1070 (1920×1200).
  See the `applyViewport()` logic and device-preview dock in
  `scheduling-panel/src/App.svelte` — in dev you can flip between panel
  resolutions from the browser.
- **Runtime config**: fetch `./config.json` at startup instead of baking
  settings into the bundle. This later lets you switch data sources on the
  deployed panel by editing one served file (`scheduling-panel/public/config.json`).

---

## Step 3 — Define the data contract FIRST

The design decision that made everything else easy: the UI never talks to a
calendar API. It talks to a five-method interface:

```ts
// scheduling-panel/src/lib/data/types.ts (mirrored in scheduling-backend/src/types.ts)
interface ScheduleProvider {
  getRoomState(now: number): Promise<RoomState>;  // status + current + next + today
  reserveNow(minutes: number, title?: string): Promise<Meeting>;
  endCurrent(): Promise<void>;
  extendCurrent(minutes: number): Promise<Meeting>;
  checkIn(): Promise<void>;
  onChange(cb: () => void): () => void;           // change notification
}
```

`RoomState` is deliberately pre-digested for a panel: `status`
(`available | reserved | checkin-pending`), `current`, `next`, `today`. The
UI renders state; it never computes calendar logic.

Everything else in the project is "an implementation of ScheduleProvider":

| Implementation | File | Purpose |
|---|---|---|
| Mock (browser) | `scheduling-panel/src/lib/data/mockProvider.ts` | UI dev with a seeded realistic day |
| HTTP (browser) | `scheduling-panel/src/lib/data/httpProvider.ts` | forwards to the backend API |
| Memory (server) | `scheduling-backend/src/memoryProvider.ts` | credential-free demo backend |
| Google (server) | `scheduling-backend/src/googleProvider.ts` | real Google Calendar |

Business rules live in the providers (e.g. *reserve is clamped to the next
meeting's start; extend rejects collisions; minimum 5 minutes*), so every
data source enforces identical behavior.

---

## Step 4 — Build the UI against the mock

`scheduling-panel/src/lib/stores/schedule.ts` is the whole state pipeline:
provider → `roomState` Svelte store → components. It refreshes on provider
change events, on a 15 s timer (meetings start/end on time boundaries with
nobody touching the panel), and after every user action. Errors from the
provider land in a `lastError` store that the UI shows inline.

The scheduling screen itself (`App.svelte`) has three states, matching how
the stock app behaves:

- **Available** (green edge) — free-until info + Reserve 15/30/60 buttons
- **Check In Required** (amber) — meeting started, not confirmed; Check In button
- **In Use** (red) — meeting details (privacy-aware), Extend, End Meeting

Plus a "Today" agenda column. Private meetings render as just "Reserved".

Seed the mock with a day that exercises every state: one meeting in progress,
a free gap big enough to book, an upcoming meeting (tests extend-collision),
and a private one (tests privacy rendering).

---

## Step 5 — Build the backend

`scheduling-backend/` is a single Node 20 process, one dependency
(`google-auth-library`). It does two jobs:

1. **The API** — five routes mirroring the contract:

   | Method | Path | Body |
   |---|---|---|
   | GET | `/api/state` | — |
   | POST | `/api/reserve` | `{minutes, title?}` |
   | POST | `/api/end` | `{}` |
   | POST | `/api/extend` | `{minutes}` |
   | POST | `/api/checkin` | `{}` |

   Provider errors return `{error}` with HTTP 409 and surface directly in the
   panel UI.

2. **Static hosting of the panel's `dist/`** — so the kiosk URL, the app, and
   the API are one origin, one process, no CORS headaches in production.
   HTTPS comes from `TLS_CERT`/`TLS_KEY` env vars.

Provider selection is an env var: `PROVIDER=memory` (default) or
`PROVIDER=google`. Building the memory provider first meant the entire
panel ↔ backend path was testable before any Google account existed:

```bash
PROVIDER=memory STATIC_DIR=../scheduling-panel/dist PORT=8080 npm start
curl localhost:8080/api/state
curl -X POST localhost:8080/api/reserve -H "Content-Type: application/json" -d '{"minutes":30}'
```

---

## Step 6 — The Google Calendar provider (free — no billing)

The Google Calendar API is a **non-billable** API: no credit card, ~1M
requests/day free quota. A panel polling every 10 s uses well under 10k/day.

Setup (personal Gmail works; Workspace not required):

1. console.cloud.google.com → new project → enable **Google Calendar API**
2. IAM & Admin → Service Accounts → create one (no roles) → Keys → new
   **JSON** key → download
3. calendar.google.com → create a dedicated calendar (stands in for a room
   resource calendar) → Settings → share it with the service account's email
   with **"Make changes to events"**
4. Copy the **Calendar ID** from "Integrate calendar"

Implementation notes (see `googleProvider.ts`):

- Auth is a `JWT` client from `google-auth-library` with the
  `calendar.events` scope — no heavyweight SDK needed; requests are plain
  REST (`events.list` / `insert` / `patch`).
- **Check-in doesn't exist in Google Calendar** — store it yourself in
  `extendedProperties.private.checkedIn` on the event.
- End-early = patch `end.dateTime` to now. Extend = patch it later, after a
  collision check against the next event.
- Private events map from `visibility: private/confidential`.
- Cache reads for ~10 s: the panel poll never hits quota, and writes
  invalidate the cache.

**Never ship Google credentials to the panel.** The key lives with the
backend only (and is gitignored); the kiosk app only ever sees `/api/*`.

---

## Step 7 — Runtime data-source switching

`config.json` is fetched by the panel app at startup, so the deployed app
flips between data sources without a rebuild:

```json
{ "schedule": { "source": "http", "backendUrl": "" } }
```

- `"mock"` — in-browser fake data (front-end dev)
- `"http"` + empty `backendUrl` — same-origin backend (production/kiosk)
- `"http"` + `"http://localhost:8080"` — Vite dev server against a local backend

Selection logic: `scheduling-panel/src/lib/stores/schedule.ts` (`initSchedule`).

---

## Step 8 — Put it on the panel

1. Host the backend (with `STATIC_DIR` pointing at the panel `dist/`) behind
   **HTTPS** reachable from the panel's network. Cert options:
   - Public CA cert (Let's Encrypt via DNS-01 works for LAN hosts) — panel
     trusts it out of the box
   - Self-signed — install into the panel: web config → Security →
     certificate store
2. In the served `dist/config.json`, set `"schedule": {"source": "http"}`.
3. Panel web config → **Settings > Applications > Application Mode** →
   **Crestron General Web Application** → enter the HTTPS URL → save. The
   panel switches apps and reboots into your UI.
4. **Rollback**: set Application Mode back to the stock scheduling app (or
   any other); it re-downloads from Crestron's cloud automatically.

The light bar does **not** follow your web app automatically (that's stock-app
behavior). Drive it from the backend via the panel's own REST API
(`LedControl` object, same auth flow as Step 1) — on the roadmap here.

---

## Verification checklist

Run all of these before calling a change done:

```bash
# Panel app
cd scheduling-panel
npm run check        # svelte-check: 0 errors
npm run build        # Vite build + CH5-compatible index.html
npm run validate     # template structure validator

# Backend
cd ../scheduling-backend
npm run check        # tsc --noEmit
npm run build && PROVIDER=memory STATIC_DIR=../scheduling-panel/dist npm start &
curl localhost:8080/api/state                     # 200 + JSON state
curl -X POST localhost:8080/api/end -d '{}'       # transitions state
curl -s -o /dev/null -w "%{http_code}" localhost:8080/   # 200 static hosting
```

Manual pass: open two browser windows on the served app and confirm an action
in one appears in the other within ~10 s.

---

## Lessons that transfer to any project like this

1. **Verify platform constraints on real hardware first.** One curl session
   against the panel (Step 1) validated the entire architecture before a line
   of app code existed. The HTTPS requirement alone reshapes hosting.
2. **Define the provider contract before the UI or the integration.** The
   mock/memory/Google providers are interchangeable because the interface
   came first; the UI was demo-able weeks before credentials existed.
3. **Same-origin everything.** One process serving app + API eliminated CORS,
   simplified TLS to one cert, and made the kiosk URL trivial.
4. **Runtime config beats build-time config** on appliance-like deployments —
   you will want to repoint a mounted panel without a rebuild.
5. **You are replacing a product, not a blank screen.** Extract the stock
   app's feature list first and treat it as the parity bar; users notice
   missing check-in enforcement faster than they notice a prettier font.
