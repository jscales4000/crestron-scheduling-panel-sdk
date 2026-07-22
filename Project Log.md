# Project Log — Crestron Custom Scheduling Panel

## v1.3.0 — 2026-07-21 — Decoded the Scheduling UI SDK; built the MCCCD holding panel

Branch `feat/ootb-holding-panel` (14 commits, **not pushed**). Spec
`docs/superpowers/specs/2026-07-21-scheduling-ootb-holding-panel-design.md`,
plan `docs/superpowers/plans/2026-07-21-ootb-holding-panel.md`.

### The headline: a route that ignores the v1.2.0 blocker
`crestron_scheduling_ui_sdk_1.4.7.1.zip` is **the complete source of Crestron's stock
scheduling app** (codename *Helium* 1.4.7.001, AngularJS 1.x + Bower + Grunt). It builds a
`.vtz` loaded onto the panel's **native OOTB app** — which needs **no internet egress at
all**. That sidesteps blocker `edc132ad` (no VLAN egress → the `com.crestron.generalweb` APK
can never download) rather than waiting on a network change. `edc132ad` is now off the
critical path, and returns only if the `.vtz` route proves impossible.

### Built (all verified in the emulator, none on glass)
Deliverable: `scheduling-ootb/app/dist/mcccd_1.5.0.zip` (`.vtz` + `~info.ini`).
A branded MCCCD District Office holding screen — logo, greeting, cross-fading messages, room
name and clock, all fed from the panel's own config — gated behind one flag. **Phase 2 is
`enabled: false` in `holdingMode.js`**, which restores the stock scheduling UI; verified with
screenshots of both states.

### ⚠️ TASK 0 IS NOT DONE — and Crestron's own doc is wrong
Attempted live against the **bench panel `[REDACTED-IP]`** (TSS-1070, serial 2122JBH00424,
fw [REDACTED], already in `Mode: OOTB`). SSH + SFTP + REST all work.
- The SDK doc says: FTP the zip to `firmware/`, then run **`OOTBPROJECTLOAD`**.
  **That command does not exist on this firmware** — `HELP` returns *Unknown Parameter*, and
  it is absent from the full command list.
- `PROJECTLOAD` exists but returns *"Device does not support this operation"* on a TSS-1070.
- Staging the stock zip in `firmware/` and **rebooting** did nothing — package untouched,
  `User/schedulingpanel/` still empty. The `.puf`-style stage-and-reboot path does not apply.
- Remaining routes are the Web Config **Actions** menu or Crestron Toolbox — a browser/human
  step. Also worth noting: the panel's own project is `shipwith-tsw-xx70.vtx` (**xx70**) while
  the SDK emits `Targets=TSW-[REDACTED-DEVICE]` (**xx60**).
- **Panel left clean**: staged zip deleted, one reboot, mode unchanged, config untouched.

### Defects found and fixed — three were mine, in the spec
1. **Dark theme rendered a completely blank white screen.** Nothing in this SDK paints a page
   background and `ThemeService` **defaults to `dark-theme`** — a freshly provisioned panel
   would have shown nothing. Fixed with `bg__theme-color-2` on the root.
2. **`impair-theme` got a black logo on a black background.** It is a *dark* theme, not light
   as the spec assumed — worst case, since that theme exists for low-vision users. Only
   surfaced after fixing #1.
3. **The panel could sit on the Crestron splash forever** when no calendar provider is
   configured — precisely the situation this screen exists for, because `readyStart` needs
   *both* `config` and `providerStatus`. Proven by neutering the emulator's publish entirely.
4. Cross-fade superimposed both sentences at ~50% for 1.2s of every 8s (illegible) — staggered.
5. Portrait clipping: `%` padding resolves against **width** on both axes while `translateY`
   resolves against **height** — 32px buffer vs 38.4px reach at 800×1280. Now `5vh 5vw`.

### Traps that cost real time (recorded so the next session skips them)
- **`http://localhost:3000` served a COMPLETELY DIFFERENT APPLICATION.** An unrelated app owns
  `[::1]:3000` and Windows resolves `localhost` to `::1` first; the SDK server binds IPv4 only.
  A screenshot of the wrong product looked entirely plausible. Use `127.0.0.1` + an odd port.
- **Reusing one Chrome profile leaked theme/layout between screenshots** — `Theme`/`LayoutService`
  read `localStorage`, so a capture rendered in a stale theme. `verify-emulator.sh` now uses a
  fresh profile per run; screenshots taken before that fix are non-hermetic.
- **`--virtual-time-budget` does not drive the CSS animation clock** — screenshot-diffing an
  animation is a false negative. Use CDP `getComputedStyle` sampling.
- **`findAppVersion()` truncates any version with >3 segments**, so `1.4.7.001` builds as
  `1.4.7` and a 4-segment custom version would collide with stock. Use 3 segments.
- Grunt 1.4.1 prints `Done.`, not `Done, without errors.`
- The app does **not** use angular-translate's filter despite bundling it — labels come from
  `assets/translations/*.json` into `Helium.labels`.

### FRED
KB: 9 curated reference documents ingested and verified searchable (the raw 21 MB archive was
cut to 1.2 MB of real reference material first — fonts, images and `bower_components` are pure
retrieval noise). Decoder doc `1e4135fc`. Tasks `0f3fd35f`, `4e1c46a0`, `53001291`, `2187c27e`
→ **review**; `b3f44c1b` → **todo (User)** with the full Task 0 findings.

### Handoff — session ended here
Handoff doc: FRED `65ac7e19-2849-47e5-a27e-3cd1adae1154` (machine Boogie, Opus 4.8).

**Resume point:** task `b3f44c1b`. The package is **built and ready** —
`scheduling-ootb/app/dist/mcccd_1.5.0.zip` (4,392,278 bytes, SHA256 `3fcf2c6e…`), rebuilt after
every fix and its contents verified. The only unknown left is **how to load it**. Next action is
not code — try **Crestron Toolbox first** (a proven workflow on this site), then Web Config →
Actions. Load the **outer zip**, do not unzip it.

**Do not** chase `edc132ad` (VLAN egress) unless the `.vtz` route proves dead — the entire point
of this route is that it needs no egress.

Branch `feat/ootb-holding-panel`, 15 commits, **not pushed**. Working tree clean.

---

## v1.2.0 — 2026-07-16 — Found the real scheduling panel; BLOCKED on no-internet VLAN

Supersedes parts of v1.1.0 below — **v1.1.0 contains wrong hardware claims** (written before
the real scheduling panel was found). Corrections here. Handoff doc: FRED `e2b6a577` (revised).

### Device map (read this first)
| IP | Name | Model | Mode | Role |
|----|------|-------|------|------|
| `[REDACTED-IP]` | `RMC4-C4426892A393` | RMC4 | — | processor, hosts the web page |
| `[REDACTED-IP]` | `[REDACTED-DEVICE]` | **TS**-1070 | `User` | room/pod touchscreen — *not* the scheduler |
| `[REDACTED-IP]` | `[REDACTED-DEVICE]` | **TSS**-1070 | `CrestronGeneralWeb` | **the scheduling panel** |

### Corrections to v1.1.0
- **The scheduling panel IS a TSS-1070** (`.104`, serial 2612JBH03876) and **has a light bar**
  (`LEDBAR` exists). v1.1.0's "it's a TS-1070, no light bar, docs are wrong" was based on `.102`,
  the **pod** panel. The original docs were right; only the IP changed. Baseline `84f3b443` applies.
- **The kiosk route is live on `.104`** (`Mode=CrestronGeneralWeb`, `ServerUrl=https://[REDACTED-IP]/html/`).
  v1.1.0's "the route is native CH5, not kiosk" is true only for `.102`.
- **Certs remain a non-issue**, but for a different reason than v1.1.0 gave: `SSLVERIFY` on `.104`
  reports *"Trusted signer on server certificates when connecting: Not required"* → the RMC4's
  self-signed cert is accepted. Do not do cert work.

### Done
- **Toolbar off on `.104`**: `VKENABLE OFF` → `Virtual key: Off` (confirmed). `.102` already had it off.
- Diagnosed the panel's permanent **"Installing"** screen — root cause below.

### BLOCKER — `10.1.33.x` has no internet egress (task `edc132ad`, assignee User)
`CrestronGeneralWeb` mode must install the **`com.crestron.generalweb` APK** from
`crestrondevicefiles.blob.core.windows.net` **before** it loads any ServerUrl. The VLAN has no
egress → APK never installs → permanent "Installing" → `ApplicationUpdateStatus=UpdateFailed`.
- `AUSTATUS`: `Couldn't resolve host name - Device will not retry. Please check DNS settings.`
- **Proof it's the subnet, not the panel:** `ping -S [REDACTED-IP] 8.8.8.8` from the dev laptop
  (same subnet/gateway) fails **identically**. The laptop reaches `1.1.1.1` only via a *different* NIC.
- `installApk.log`: stock app installed from a local file; generalweb only reaches
  `Missing application data for 00000017 mode → NEED_INSTALL=1`, with no install line following.
- **The placeholder + RMC4 hosting are blameless** — `https://[REDACTED-IP]/html/` serves 200; the
  panel never gets far enough to fetch it.

Options: (1) NAT via the dual-homed dev laptop, (2) open VLAN egress briefly, (3) abandon kiosk for
native CH5 from the RMC4 like `.102` — unverified for a TSS-1070.

### Panel state left changed (may need reverting)
- `VKENABLE OFF` — intended.
- `ADDDns 8.8.8.8` + `8.8.4.4` — **staged pending reboot, UNTESTED**. Wrong if the site uses an
  internal resolver.
- `DEFROUTER 0 [REDACTED-IP] /now` — **no-op**; gateway was already configured.

### Debugging traps (cost real time — recorded so the next session doesn't repeat them)
- **Windows `ping` counts ICMP "Destination net unreachable" as *received*** → prints `0% loss` on
  total failure. This caused a **wrong diagnosis** ("the subnet has internet; the gateway is
  singling out the panel") that had to be retracted. Look for literal `bytes=` echo replies.
- **`ROUTEPRINT` shows no default route** on the panel though `DEFRouter`/`IPCONFIG` report one —
  **red herring**; packets do reach the gateway (it answers with ICMP errors).
- **`tar` needs `--force-local`** on Windows paths, else `C:` parses as a remote host.
- Panel SSH console needs paramiko `invoke_shell`, not `exec_command`.
- Panel log timestamps run ~7.6 h ahead of local (UTC offset) — not a fault.

### Tasks
- `edc132ad` created → **todo** (User) — the blocker.
- `49c8e33b` → **review**; `b826440a` → **todo**. No commits.

---

## v1.1.0 — 2026-07-16 — Route change: native CH5 on processor; placeholder live on RMC4

> **NOTE (superseded):** the hardware claims in this entry are WRONG — see v1.2.0 above.
> This was written before the real scheduling panel (`.104`, a TSS-1070) was found.

Session on machine `Boogie` (FRED project `cb891811-0872-4723-a87e-3e7af4530656`).
Handoff doc: FRED `e2b6a577-af23-4853-a42b-481341739fe9`.

### Route change — the cert/kiosk plan is dead
Session opened intending the self-signed-cert + "Crestron General Web Application"
kiosk switch-over. Jordan redirected mid-session: **the deliverable is an archived
CH5 project loaded on the processor** — the *native* CH5 route. This **eliminates all
cert work**: no self-signed cert, no panel trust-store install, no `ServerUrl`, no
separate HTTPS host. No cert was created or installed. Panel `Mode` was never changed
(left at `User`).

### Hardware reality check — docs describe the wrong panel
- Every prior doc describes a **TSS-1070** (scheduling panel) @ `[REDACTED-IP]`, serial
  2122JBH00424, Mode `OOTB`. That panel is **unreachable** — no `192.168.2.x` interface
  exists on this machine anymore.
- Actual panel: **TS-1070** (general touchscreen, *not* the scheduling variant) @
  `[REDACTED-IP]`, serial 2615JBH03351, named **[REDACTED-DEVICE]**, Mode `User`.
- Consequence: no light bar, no scheduling-specific hardware → parts of the parity
  baseline (`84f3b443`) do not apply to this hardware.

### Placeholder proven live
- Built `placeholder/index.html` — 1.7 KB, **single self-contained file** (image is an
  inline SVG; no external refs). Live clock included as proof-of-life.
- Jordan uploaded via **Crestron Toolbox** → Web Pages and Mobility Projects
  (Format=Folder, Name=`placeholder`, Type=`MobileApp`, Internal Flash, `/html/`).
- **Verified serving at `https://[REDACTED-IP]/html/`** — fetched back byte-identical.
  Unauthenticated `GET` → 200; `/Device/*` still auth-gated. Admin UI intact
  (`userlogin.html` + `resources/` untouched, login still issues XSRF token).

### Built, not deployed
- `output/scheduling-panel.ch5z` (412 KB) archived + verified; `scheduling-panel-html.zip`
  (414 KB) packaged; all dist files smoke-tested 200. Asset paths are relative → serves
  from any subdirectory.
- Fixed stale `public/config.json` host `[REDACTED-IP]` → `[REDACTED-IP]` (uncommitted).

### Defects found (not fixed)
- `scheduling-panel/package.json` `deploy` script is **broken** and has never run: passes
  the `.ch5z` to `-i` (`--identity-file`, a *private key* path) and omits the positional
  `<archive>`. Correct form: `ch5-cli deploy -H [REDACTED-IP] -t controlsystem -u ${PANEL_USER} -p output/scheduling-panel.ch5z`.
  May be removed entirely since Toolbox works.
- `CLAUDE.md` says the `.ch5z` route "does not apply here" — **backwards**; it *is* the route.

### Gotchas
- **Crestron REST auth needs `Referer` + `Origin` headers** — POST `/userlogin.html` is 403
  without them on both devices. Credentials were never the problem.
- **`/html` on the RMC4 is the processor's own admin UI**; there is no `/HTML` (what
  `ch5-cli -t controlsystem` targets). Prefer Toolbox over a raw SFTP dump.
- **Windows `EBUSY`**: a shell CWD inside `dist` locks it; `build.mjs` dies at `rmSync(dist)`
  *after* vite succeeds, so output looks partly fine. `cd` out of `dist` before building.
- **Page Authentication must stay OFF** for kiosk display — a panel cannot answer an auth
  challenge. Open question for real data: meeting titles become LAN-visible.
- **Correction:** RMC4 slot 1 has **no program loaded** (`Status: Stopped`); the NVX
  encoders seen `ONLINE` are IP-table entries, independent of a loaded program. Earlier
  in-session warnings that this was a running production system over-stated it.
- KB has **no coverage** of 4-Series web hosting / ch5z→processor loading — probe devices
  directly rather than searching.

### Tasks
- `49c8e33b` created → **review** — RMC4 native-CH5 hosting, placeholder proven.
- `b826440a` created → **todo** — fix deploy script + CLAUDE.md guidance.
- No commits made.

### Next
Upload the real app (`scheduling-panel/dist`) via the now-proven Toolbox path, or point
the TS-1070 at `https://[REDACTED-IP]/html/`.

---

## v1.0.0 — 2026-07-12 — Initial build: research → working demo (first push)

Session summary (single session, FRED project `cb891811-0872-4723-a87e-3e7af4530656`):

### Research & platform verification
- Created FRED project "Scheduling Panel SDK"; applied the Crestron Project persona pack (11 specialists).
- Audited the FRED knowledge base: strong coverage of TSS/TSW-x70 docs (8205/8550/8745/8989) and CH5 development; identified gaps (calendar APIs, Fusion API reference).
- Extracted a stock-scheduling-app feature baseline from KB docs → FRED doc `84f3b443` (parity checklist: booking rules, check-in/no-show windows, privacy levels, light bar, provisioning, calendar providers).
- Confirmed from Crestron docs 8745: custom panels run via **"Crestron general web application"** kiosk mode; URL must be HTTPS.
- Probed the bench TSS-1070 ([REDACTED-IP]) over its REST API: firmware [REDACTED], app mode OOTB, `CrestronGeneralWeb` supported. Switch-over steps documented in FRED doc `be457823`. Panel mode NOT yet switched (hosting/cert pending).

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
- Live demo left running: http://localhost:8080 / http://[REDACTED-IP]:8080 (memory provider).

### Decisions of record
- Hardware: TSS-1070 @ [REDACTED-IP]; deployment via kiosk web-app mode.
- Scope: strictly demo for now — memory provider; Google Calendar optional later (free, no billing).
- Next: self-signed cert + panel cert-store install to put the demo on real glass; light-bar via panel REST; parity features (check-in enforcement, auto-release, themes).

### FRED state at push
Tasks: 3 done (hardware decision, calendar decision, —), 4 in review (baseline, scaffold, kiosk verification, backend). Personas: Crestron Project pack active.
