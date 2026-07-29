# Project Log — Crestron Custom Scheduling Panel

## v1.0.0 — 2026-07-12 — Initial build: research → working demo (first push)

Session summary (single session, FRED project `cb891811-0872-4723-a87e-3e7af4530656`):

### Research & platform verification
- Created FRED project "Scheduling Panel SDK"; applied the Crestron Project persona pack (11 specialists).
- Audited the FRED knowledge base: strong coverage of TSS/TSW-x70 docs (8205/8550/8745/8989) and CH5 development; identified gaps (calendar APIs, Fusion API reference).
- Extracted a stock-scheduling-app feature baseline from KB docs → FRED doc `84f3b443` (parity checklist: booking rules, check-in/no-show windows, privacy levels, light bar, provisioning, calendar providers).
- Confirmed from Crestron docs 8745: custom panels run via **"Crestron general web application"** kiosk mode; URL must be HTTPS.
- Probed the bench TSS-1070 over its REST API: app mode OOTB, `CrestronGeneralWeb` supported. Switch-over steps documented internally. Panel mode NOT yet switched (hosting/cert pending).

### Built
- **`scheduling-panel/`** — Svelte 5 + Vite 6 CH5 app (from FRED ch5-svelte-v2 template; fixed unsubstituted `__ROOM_NAME__` token):
  - `ScheduleProvider` contract (`src/lib/data/types.ts`), mock provider with seeded day, HTTP provider, store pipeline (`stores/schedule.ts`).
  - Full scheduling UI: Available / Check-In-Required / In-Use states, Reserve 15/30/60, End, Extend 15, today agenda, privacy-aware titles, TSW/TSS resolution preview dock.
  - Runtime data-source selection from `config.json` (`mock` | `http`) — deployed panels repoint without rebuild.
- **`scheduling-backend/`** — Node 20 + TypeScript, single dep (`google-auth-library`):
  - API: `/api/state|reserve|end|extend|checkin` (409 + `{error}` on rule violations).
  - Serves the panel `dist/` statically (same-origin kiosk target); optional TLS via `TLS_CERT`/`TLS_KEY`.
  - Providers: `memory` (credential-free demo) and `google` (Calendar API v3 via service account: events list/insert/patch, check-in via `extendedProperties`, 10 s read cache). Google mode compiles, untested pending credentials (demo scope: memory only, per Jordan).
- **Docs**: `README.md` (architecture, quick start, panel facts, roadmap) and `docs/BUILD-GUIDE.md` (full instructional guide to reproduce the project), `scheduling-backend/README.md`, FRED docs (`36cf99aa` Google API reference, `84f3b443` baseline, `be457823` deployment guide).

### Verified
- Panel: svelte-check 0 errors; Vite build clean; template validator passes; FRED guardrails pass.
- Backend: tsc clean; end-to-end curl smoke in memory mode — busy-rejection, check-in, extend (+15 min exact), end-early, walk-up reserve, static hosting all correct.
- Live demo left running on `http://localhost:8080` (memory provider).

### Decisions of record
- Hardware: TSS-1070 on the bench network; deployment via kiosk web-app mode.
- Scope: strictly demo for now — memory provider; Google Calendar optional later (free, no billing).
- Next: self-signed cert + panel cert-store install to put the demo on real glass; light-bar via panel REST; parity features (check-in enforcement, auto-release, themes).

### FRED state at push
Tasks: 3 done (hardware decision, calendar decision, —), 4 in review (baseline, scaffold, kiosk verification, backend). Personas: Crestron Project pack active.
