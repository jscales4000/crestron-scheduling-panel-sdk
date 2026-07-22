# Design — OOTB Holding Panel (MCCCD District Office)

- **Date:** 2026-07-21
- **FRED project:** `cb891811-0872-4723-a87e-3e7af4530656` (Scheduling Panel SDK)
- **Status:** design approved, pending implementation plan
- **Target panel:** `[REDACTED-IP]` — `[REDACTED-DEVICE]`, TSS-1070, fw [REDACTED]

## 1. Summary

Build a branded static holding screen for the MCCCD District Office scheduling
panel, derived from Crestron's Scheduling UI SDK 1.4.7.1 and loaded onto the
TSS-1070 as a native OOTB scheduling project (`.vtz`).

Phase 1 replaces the scheduling UI entirely with a holding screen. Phase 2
re-enables the real scheduling views from the same source tree by flipping one
flag.

## 2. Why this route

The project is currently blocked (FRED task `edc132ad`): `CrestronGeneralWeb`
kiosk mode must download the `com.crestron.generalweb` APK from
`crestrondevicefiles.blob.core.windows.net` before it loads any `ServerUrl`, and
the `10.1.33.x` VLAN has no internet egress. The panel sits on a permanent
"Installing" screen.

The OOTB route does not touch that path. The scheduling app is already installed
natively; loading a project is a local FTP push plus a console command. **No
internet egress is required.** This is the decisive reason to prefer it.

## 3. What the SDK is (decode summary)

`crestron_scheduling_ui_sdk_1.4.7.1.zip` is the complete source of Crestron's
stock scheduling application, codename **Helium**, v1.4.7.001.

| Aspect | Detail |
|---|---|
| Stack | AngularJS 1.x, Bower, Grunt, dart-sass 1.71 via `grunt-sass` 3.1 |
| Entry | `UI_Project/app` — run all Grunt commands from here |
| Package | `<name>_<ver>.zip` = `<name>_<ver>.vtz` + `~info.ini` |
| `~info.ini` | `[Firmware]` / `Filename=` / `Version=` / `Targets=TSW-[REDACTED-DEVICE]` |
| Manifest | `appui/manifest` → `version: <ver>`, `apptype: scheduling` |
| Install | FTP zip to panel `firmware` dir → `OOTBPROJECTLOAD`; or Web Config → Actions |

`crestron_scheduling_css_1.4.7.1.zip` contains seven stylesheets that are
**byte-identical** to the compiled CSS inside the shipped `.vtz` (verified:
`horizontal.css` 85,845 B in both). They are reference stylesheets — themes
`light` / `dark` / `impair`, layouts `horizontal` / `portrait` / `vertical`, plus
`splash` — provided so overrides can be authored against known selectors.

### 3.1 Panel bridge — `SchedulingPanel.webUI`

Injected at runtime by `<script src="http://crestron/scheduling-panel-communication">`.
`vendor/crestron/schedulingPanel.js` is the local mirror; underneath it is an
Android WebView `JSInterface`.

- **`subscribe.data`** — `config`, `language`, `timeline`, `providerStatus`, `events`
- **`send.action`** — `extendEvent`, `endEvent`, `createEvent`, `roomSearch`,
  `detailsEvent`, `checkInEvent`, `openSettings`, `refreshSchedule`, `statusScreenInfo`
- **Light bar** — `setLEDEnabled(color, bool)`, `setLEDBrightness(color, 0-100)`
  where color is `0=Red 1=Green 2=Blue`

> The SDK warns in-source that calling the LED functions **disables default LED
> logic until the panel is rebooted.** This design never calls them, so stock
> light-bar behavior is preserved.

Calendar data originates from the panel's own provider (`schedule.source`, e.g.
Fusion/Exchange). The existing `scheduling-backend/` is not used on this route.

### 3.2 No-code customization vectors (for later reference)

Settable from panel config without any rebuild:

1. `room.styleOverrideUrl` — remote CSS URL, cache-busted with `?v=<timestamp>`
   (`services/settings.js:106,119`). Empty → falls back to local `custom.css`,
   which ships as a **0-byte file** in the `.vtz`. The sanctioned override slot.
2. `display.backgrounds` — per-state remote media for `availableActive`,
   `availableIdle`, `reservedActive`, `reservedIdle`.
3. `display.projectIconUrl` — remote logo.

### 3.3 Known risk — target generation mismatch

`Targets=TSW-[REDACTED-DEVICE]` names the **previous** panel generation. The target
hardware is a TSS-1070 (x70). Whether fw [REDACTED] accepts an `XX60`-targeted
`.vtz`, and how SDK 1.4.7 relates to the OOTB version actually installed on
`.104`, is **unverified**. See §8 Step 0.

## 4. Repository layout

New top-level `scheduling-ootb/`, sibling to `scheduling-panel/` (Svelte, left
untouched) and `scheduling-backend/`.

```
scheduling-ootb/
  app/                        vendored SDK UI_Project/app; Grunt runs here
    src/                      our changes live here as diffs vs the baseline
      assets/images/brand/    MCCCD logo set
    apps/mcccd/               --app= target folder
  reference/                  stock schedulingproject_1.4.7.zip, kept for rollback
  README.md                   build + deploy runbook
```

Brand assets must sit under `src/assets` — `Gruntfile.js:346` copies
`<src>/assets` to `<dest>/assets` wholesale, so `src/assets/images/brand/` lands
at `assets/images/brand/` in the `.vtz` with no Grunt change required.
`src/buildInfo.json` governs only Bower `externalLibs` copying and does not need
editing.

The root `.gitignore` already covers `dist/`, `node_modules/`, and `.env`, which
is correct for this tree — the SDK's prebuilt `app/dist/` is regenerable and is
not committed.

## 5. Holding-mode gate

`'room'` is requested from four places: `configs/route.js` (`defaultURL`),
`services/appState.js:203`, `services/settings.js:147`, and
`controllers/screensaver.js:74`. Rather than edit four call sites, the design
uses the single chokepoint — `$rootScope.Helium.methods.openPage`, defined at
`services/appState.js:266`.

- **`src/js/constants/holdingMode.js`** — new constant holding `enabled`, the
  target page name, cycle timing, and the message copy (see §6.3).
- **Gate in `openPage`** — when enabled, requests for `room` and `screensaver`
  resolve to `holding`.
- **`configs/route.js`** — `defaultURL` becomes `views/partials/holding.html`
  when enabled.
- Splash still runs first (`run.js:35`), unchanged, then lands on holding.

**Phase 2 is `enabled: false`.** One line restores the stock app; views can then
be re-enabled selectively. This is the entire reason for gating rather than
deleting.

### 5.1 Screensaver suppression

The stock screensaver is suppressed — the holding screen is itself the permanent
view, and letting the screensaver cover it would defeat the branding. The
holding controller calls `AppStateService.stopScreensaverTimeout()` on init and
does not re-arm it. Burn-in is handled by §7 instead.

## 6. The holding screen

`views/partials/holding.html` + `controllers/holding.js`.

### 6.1 Data sources — everything comes from the panel

| Element | Source |
|---|---|
| Room name | `Helium.values.roomName`, set by `services/settings.js:33` from `settings.room.name` |
| Clock | `AppClockService.subscribe` — ticks on the minute (`services/appClock.js:39`) |
| Date/time format | `Helium.settings.room.timeFormat` / `dateFormat`, already normalized by `settings.js`, rendered via Angular's `date` filter |
| Theme | `Helium.state.theme` ∈ `light-theme` \| `dark-theme` \| `impair-theme` |
| Layout | `Helium.state.layout` ∈ `horizontal` \| `vertical` \| `portrait` |

Clock resolution is **minutes, not seconds** — it matches `AppClockService`,
matches the rest of the app, and avoids adding a second timer to a 24/7 device.

### 6.2 Logo selection

Both `Helium.state.theme` and `Helium.state.layout` are already on `$rootScope`,
so logo choice is a template binding — `f(layout, theme)` — with no new service:

| Layout | Theme | Asset |
|---|---|---|
| `horizontal` | `dark-theme` | `District_Office/Horizontal/White/Logo_WHITE_MCCCD_Horizontal.png` |
| `horizontal` | `light-theme` / `impair-theme` | `District_Office/Horizontal/Black/Logo_BLACK_MCCCD_Horizontal.png` |
| `vertical` / `portrait` | `dark-theme` | `District_Office/Vertical/White/Logo_WHITE_MCCCD_Stacked.png` |
| `vertical` / `portrait` | `light-theme` / `impair-theme` | `District_Office/Vertical/Black/Logo_BLACK_MCCCD_Stacked.png` |

Source assets: `Logos/MCCCD/maricopa-logos.zip`. The loose
`Logos/MCCCD/logo-{black,rgb,white}-mcc.png` files (1030×200) are the horizontal
lockup and may be used directly for that orientation.

### 6.3 Copy

The app does **not** use the `translate` filter despite bundling
angular-translate. Labels load from `assets/translations/{lang}.json` into
`$rootScope.Helium.labels` (`services/localization.js:24`), across ~30 language
files.

This copy is site-specific, not product UI, so it does **not** go in those files.
It lives in `holdingMode.js` as a language-keyed map with an `en` default and
`en` fallback — one editable location, and still extensible to Spanish later
(relevant for a Maricopa County audience).

```
greeting:  "Welcome to the new District Office"
phrases:   [ "Pardon our dust while we move in.",
             "Scheduling coming soon." ]
```

The greeting is persistent. The two phrases cross-fade in a dedicated slot.

## 7. Motion and burn-in

Two independent layers.

**Layer 1 — global pixel-shift (the guarantee).** The whole content block slowly
orbits ±3–4% of viewport over roughly a four-minute period. This is the standard
display mitigation and it protects every element, including the logo, regardless
of what the text is doing.

**Layer 2 — phrase cross-fade (the designed motion).** The message slot fades
between the two phrases on roughly an 8-second cadence. Beyond looking
intentional, it keeps the highest-contrast text region continuously changing.

### 7.1 Animation constraints (non-negotiable on this hardware)

The panel is an Android WebView running 24/7 in a wall enclosure.

- **`transform` and `opacity` only** — these are compositor-only properties. No
  animated `filter`, `box-shadow`, `width/height`, or `top/left`.
- **CSS `@keyframes` only** — no JS `requestAnimationFrame` loop and no
  `ngAnimate` for this; the phrase index advances on a single `$interval`.
- Long durations, low frequency. Nothing runs faster than the 8-second cadence.

### 7.2 Accessibility

Under `impair-theme` the phrase cross-fade is disabled and both phrases render
statically; the layer-1 drift continues. The SDK ships that theme for low-vision
users, and motion works directly against that need.

## 8. Build, deploy, rollback

### Step 0 — prove the package format first (before any code)

FTP the **unmodified** `UI_Project/build/schedulingproject_1.4.7.zip` to the
panel's `firmware` directory and run `OOTBPROJECTLOAD`. This answers §3.3 at zero
cost. **If this fails, this entire design is void** and the fallback is a
hand-authored `.vtz` or a return to the kiosk route.

`.104` is currently `Mode=CrestronGeneralWeb` and must be switched back to the
scheduling/OOTB mode. This is a real panel-state change and goes in the Project
Log.

### Build

```
cd scheduling-ootb/app
npm install -g bower grunt
npm install                              # postinstall runs bower install
grunt --app=mcccd --debug --emulate      # localhost:3000, mocked calendar
grunt --app=mcccd --dist                 # dist/mcccd_<ver>.zip
```

`--app=` must name a folder that exists in `apps/`. Bump `src/appInfo.json`
version so the panel registers a distinct build. Node 20.12.2 / npm 10.5.0 is
the verified local environment; `grunt-sass` uses dart-sass, so there is no
`node-sass` native-build hazard.

### Rollback

Reload `schedulingproject_1.4.7.zip` by the same mechanism. It is kept at
`scheduling-ootb/reference/` — outside the build tree and committed — so a
rollback never depends on a working toolchain or an intact `node_modules`.

## 9. Verification

**Emulator** (`--debug --emulate`): all 3 layouts × 3 themes render correctly;
logo variant matches the matrix in §6.2; phrase cycling runs and is suppressed
under `impair-theme`; clock renders in both 12h and 24h config.

**On glass** (`.104`): room name matches panel config; clock matches wall time;
no scheduling control is reachable by touch; screensaver never appears; light
bar behaves exactly as stock (nothing calls `setLED*`); panel survives an
overnight soak without visible stutter or heat complaint.

## 10. FRED ingestion

Deliberately after the decode, per the project owner's instruction, so what
lands in the KB is understood rather than raw.

1. **KB source** — SDK + CSS ingested so RAG can search bridge APIs and selectors.
2. **Decoder document** — a FRED project doc capturing §3 in full: bridge API
   table, config schema, build flags, `.vtz` / `~info.ini` package format,
   install command, and the §3.3 generation caveat.
3. **Project/task updates** — record the OOTB route as an alternative to the
   `edc132ad` blocker.

## 11. Out of scope

- Any calendar integration (that is phase 2)
- `scheduling-backend/` — unused on this route
- Changes to `scheduling-panel/` (Svelte/CH5)
- Resolving the VLAN egress blocker `edc132ad` — this design routes around it,
  it does not fix it
- Light-bar control

## 12. Open items carried into the plan

- §3.3 generation mismatch — resolved or killed by Step 0
- Exact orbit amplitude and period need tuning on real glass; the ±3–4% / ~4 min
  figures are a starting point, not a measured result
- Whether the District Office wants the RGB logo lockup on light theme instead
  of black
