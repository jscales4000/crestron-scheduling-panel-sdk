# MCCCD OOTB Holding Panel

Branded holding screen for the MCCCD District Office scheduling touchscreen
(TSS-1070, `[REDACTED-IP]`), built by customizing Crestron's Scheduling UI SDK
1.4.7.1 ("Helium") in place and loading the result onto the panel as a native
OOTB scheduling project (`.vtz`). Phase 1 replaces the scheduling UI with a
static holding screen (room name, clock, cross-fading phrases, MCCCD logo);
phase 2 restores the real scheduling views from the same source tree with a
one-line flag flip.

Design spec: `docs/superpowers/specs/2026-07-21-scheduling-ootb-holding-panel-design.md`
FRED SDK decoder doc: `1e4135fc-95ee-4c87-8529-07d29411964e`
FRED project: `cb891811-0872-4723-a87e-3e7af4530656` ("Scheduling Panel SDK")

## Prerequisites

- Node **20.12.2** / npm **10.5.0** (verified against this checkout).
- Global `bower` and `grunt-cli`:
  ```bash
  npm install -g bower grunt-cli
  ```
- From `scheduling-ootb/app`:
  ```bash
  npm install
  ```
  `npm install` runs `bower install` automatically via the `postinstall` script
  in `package.json` — no separate `bower install` step is needed.

## Build modes

All commands run from `scheduling-ootb/app`. `--app=` must name a folder that
exists under `app/apps/` (currently `mcccd` and `schedulingproject`) —
`validateApp()` in `Gruntfile.js` throws otherwise.

### 1. Panel package (production)

```bash
grunt --app=mcccd --dist
```

Minifies JS/CSS, builds `index.html`, and packages everything into
`dist/mcccd_<version>.zip` (also copied to `scheduling-ootb/build/`). The zip
contains exactly two entries: `mcccd_<version>.vtz` and `~info.ini`. This is
the file you FTP to the panel. Grunt 1.4.1 prints `Done.` on success; jshint
and Sass errors both fail the build — never mask a failure with `--debug` to
get past it, since `--debug` changes what gets built (see below), not just how
noisy it is.

`--dist` is silently ignored if `--debug`, `--initbuild`, or `--emulate` is
also present (see the flag guards in `Gruntfile.js`).

### 2. Browser dev with a mocked calendar

```bash
grunt --app=mcccd --debug --emulate
```

Builds unminified files into `public/` and wires in the emulator's mocked
calendar data instead of the panel's native Android bridge, so the app can be
opened in a normal browser via `node server.js`. `--emulate` only takes effect
when `--debug` is also set (`isEmulating = ... && isDebugging` in the
Gruntfile) — passing `--emulate` alone does nothing.

Use `scheduling-ootb/verify-emulator.sh` rather than starting the server by
hand:

```bash
bash scheduling-ootb/verify-emulator.sh <output-name> [url-path]
```

This exists because of two traps that both hit for real during development:

- **Port collision.** An unrelated app on this machine listens on
  `[::1]:3000`. The SDK's `server.js` binds `0.0.0.0` (IPv4 only), and Windows
  resolves `localhost` to `::1` first — so `http://localhost:3000` silently
  serves a **completely different application** with a plausible-looking page.
  The script binds an unusual port (3177) and addresses it via the literal
  `127.0.0.1`, never `localhost`, and asserts on `<title>Helium</title>`
  before screenshotting.
- **Headless Chrome needs `--user-data-dir`.** Without it, the screenshot
  write fails with "Access is denied" while Chrome still exits `0` — a
  silent, successful-looking no-op. The script always passes
  `--user-data-dir`.

### 3. CSS-only tweaks without touching `src`

```bash
grunt --app=mcccd --initbuild
# hand-edit generated CSS under app/apps/mcccd/
grunt --app=mcccd --build
```

`--initbuild` compiles CSS, concatenates JS, builds `index.html`, and copies
everything into `app/apps/<name>/`, where the CSS can be hand-edited in place.
`--build` then copies those files (with edits) into `public/` or `dist/`
depending on whether `--debug` is also set. This pair exists for making
one-off styling tweaks to a built app without going back through `src/`; it is
not the path used for this holding-panel project's source changes.

## Deploy

1. FTP the built zip (e.g. `dist/mcccd_1.5.0.zip`) to the panel's `firmware`
   directory.
2. From the panel's text console, run:
   ```
   OOTBPROJECTLOAD
   ```
   GUI alternative: Web Configuration → Actions → browse to the file and load
   it from there.

## Rollback

Reload `scheduling-ootb/reference/schedulingproject_1.4.7.zip` using the same
FTP + `OOTBPROJECTLOAD` mechanism above. This file is the stock 1.4.7 package
and is committed to the repo specifically so rollback never depends on a
working build toolchain — it works even if `node_modules`/`bower_components`
are missing or broken.

## Turning holding mode off (phase 2)

Set `enabled: false` in
`scheduling-ootb/app/src/js/constants/holdingMode.js`, then rebuild
(`grunt --app=mcccd --dist`) and redeploy. That single flag is the master
switch for the whole holding-screen behavior; with it `false` the app is the
stock, unmodified scheduling UI. This was verified working during earlier
implementation work on this feature.

## Changing the holding-screen copy

Edit `HoldingMode.copy` in the same file,
`scheduling-ootb/app/src/js/constants/holdingMode.js`. It's keyed by
two-letter language code with `en` as the fallback (greeting + list of
cross-fading phrases). This copy deliberately does **not** live in
`assets/translations/*.json` — those ~30 files hold the SDK's own product UI
text (button labels, dialog strings, etc. across every supported language),
whereas `HoldingMode.copy` is one site's custom signage and belongs with the
feature that renders it.

## Known caveats

- `~info.ini` (generated by the `makeIni` task in `Gruntfile.js`) declares
  `Targets=TSW-[REDACTED-DEVICE]` — the **previous** panel generation, not the TSS-1070
  x70 series this panel actually is. The string is hardcoded in the `makeIni`
  task and can be changed there if it ever needs to be, but **only** on the
  strength of confirmed Crestron documentation or a panel-side error message —
  do not guess. As of this writing, acceptance of this package on x70 hardware
  (TSS-1070) is **unverified**.
- `src/scss/custom.scss` is intentionally left empty in this project; no
  custom CSS hooks are used.
- Nothing in this codebase calls `setLEDEnabled`/`setLEDBrightness` — the
  panel's light bar behaves exactly as it does on the stock app.
