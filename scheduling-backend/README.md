# scheduling-backend

Backend for the custom TSS-1070 scheduling panel. One process serves both the
schedule API and the built panel app (`scheduling-panel/dist/`) — the panel's
kiosk "Crestron general web application" URL points here.

## Providers
- `PROVIDER=memory` (default) — in-memory seeded day, no credentials. Dev/demo.
- `PROVIDER=google` — Google Calendar API v3 via service account.

## Run

```bash
npm install
npm run build
PROVIDER=memory STATIC_DIR=../scheduling-panel/dist PORT=8080 npm start
```

See `.env.example` for all settings.

## Google setup (when credentials are ready)
1. Create a GCP service account, download its JSON key.
2. Share the room's resource calendar (or any Google calendar) with the
   service-account email — permission "Make changes to events".
3. `PROVIDER=google GOOGLE_CALENDAR_ID=<calendar id> GOOGLE_SA_KEY_FILE=<key.json> npm start`

Full API notes: FRED doc "Google Calendar API — Panel Backend Reference".

## API (mirror of the panel's `ScheduleProvider` contract)
| Method | Path | Body |
|---|---|---|
| GET | `/api/state` | — |
| POST | `/api/reserve` | `{minutes, title?}` |
| POST | `/api/end` | `{}` |
| POST | `/api/extend` | `{minutes}` |
| POST | `/api/checkin` | `{}` |

Errors return `{error}` with status 409.

## Pointing the panel app at this backend
`config.json` is fetched by the panel app **at runtime**, so no rebuild needed:
in the served `dist/config.json` set `"schedule": {"source": "http", "backendUrl": ""}`
(empty backendUrl = same origin). For dev against `npm run dev` on :5173, set
`backendUrl` to `http://localhost:8080` in `scheduling-panel/public/config.json`.

## Production notes
- The TSS-1070 kiosk mode **requires an HTTPS URL** — set `TLS_CERT`/`TLS_KEY`
  (panel trusts public CAs out of the box; self-signed needs a cert install on
  the panel).
- Light bar: the kiosk web app has no joins; drive the LED via the panel's own
  REST API (`Device/.../LedControl`) from this backend if desired (future task).
