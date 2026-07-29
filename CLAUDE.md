# Scheduling Panel SDK

Custom Crestron room-scheduling panel (HTML5/CH5) replacing the stock scheduling
app on Crestron scheduling touchscreens (TSS-770/1070 class). Greenfield as of
2026-07-12.

## FRED Project
- Project ID: `cb891811-0872-4723-a87e-3e7af4530656`
- Name: `Scheduling Panel SDK`
- Namespace: `default`

## Hardware & deployment
- Panel: **TSS-1070** on a private bench network (host + credentials tracked out-of-band).
- Deployment: "Crestron general web application" kiosk mode — host the built `scheduling-panel/dist/` and point the panel's web-app URL at it. The `npm run deploy` (.ch5z) script is the TSW route and does not apply here.
- Calendar source: Google Calendar via a backend service (see FRED doc "Google Calendar API — Panel Backend Reference").

## Code layout
- `scheduling-panel/` — CH5 + Svelte 5 + Vite 6 panel app (FRED ch5-svelte-v2 template).
  - `src/lib/data/types.ts` — `ScheduleProvider` interface; Google provider must implement it.
  - `src/lib/data/mockProvider.ts` — seeded mock day (current dev data source).
  - `src/lib/stores/schedule.ts` — provider → stores pipeline; swap provider here.
  - `npm run dev` to run locally; `npm run check` + `npm run validate` before committing.
  - Provider selected at runtime from `config.json` → `"schedule": {"source": "mock"|"http", "backendUrl": ""}`.
- `scheduling-backend/` — Node 20 + TS backend; serves the schedule API and statically hosts the panel dist (the kiosk HTTPS target).
  - `PROVIDER=memory` (no creds, default) or `PROVIDER=google` (service account; see its README).
  - Run: `npm run build && PROVIDER=memory STATIC_DIR=../scheduling-panel/dist npm start`.
- Panel bench facts: TSS-1070 fw [REDACTED], currently in OOTB app mode; kiosk switch = web config Settings > Applications → "Crestron General Web Application" (HTTPS URL required). Do not switch until hosting + cert are ready. See FRED docs be457823 (deployment) and 84f3b443 (stock-app parity baseline).

## Session start
1. `mcp__fred__find_tasks(filter_by="project", filter_value="cb891811-0872-4723-a87e-3e7af4530656")`
2. `mcp__fred__get_active_persona_instructions(project_id="cb891811-0872-4723-a87e-3e7af4530656")` — 11 Crestron personas assigned (CH5 Extended/Native, SIMPL+/#, UX, REST API, Fusion, etc.)
3. Research KB before implementing — scheduling panel docs live in sources 8745 (TSS-770/1070), 8989 (Flex UC x70), 9259, 8550.
