# OOTB Holding Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a branded MCCCD District Office holding screen to the TSS-1070 at `[REDACTED-IP]`, built from the Crestron Scheduling UI SDK and loaded as a native OOTB `.vtz`.

**Architecture:** Vendor the SDK's `UI_Project/app` tree, then add a *holding mode* gated behind a single constant. All navigation to `room`/`screensaver` is intercepted at one chokepoint (`$rootScope.Helium.methods.openPage`) and redirected to a new `holding` route. Phase 2 is `enabled: false`, which restores the stock scheduling app in one line.

**Tech Stack:** AngularJS 1.x, Grunt, dart-sass, Bower. Node 20.12.2 / npm 10.5.0.

**Spec:** `docs/superpowers/specs/2026-07-21-scheduling-ootb-holding-panel-design.md`

## Global Constraints

- **`--app=` must name a folder that exists in `app/apps/`** — `Gruntfile.js` `validateApp()` throws otherwise. This is required even when building from `src`.
- **`--emulate` only works with `--debug`** (`Gruntfile.js:17`). `--dist` is ignored if `--debug`, `--initbuild`, or `--emulate` is set (`Gruntfile.js:20`).
- **`jshint` is a hard build gate.** It runs first in the default Grunt task with `force: isDebugging`, so a non-debug build **fails** on lint errors. Never bypass it.
- **Animation: `transform` and `opacity` only.** No animated `filter`, `box-shadow`, `width`/`height`, `top`/`left`. No `requestAnimationFrame` loops. This is a 24/7 Android WebView in a wall enclosure.
- **Do not call `setLEDEnabled` / `setLEDBrightness`.** They disable default light-bar logic until the panel reboots.
- **Leave `src/scss/custom.scss` empty.** It compiles to the 0-byte `custom.css` override slot in the `.vtz`, reserved for post-deploy `styleOverrideUrl` iteration.
- **Clock is minute-resolution.** Subscribe to `AppClockService`; do not add a second timer.
- **Copy, verbatim:**
  - Greeting: `Welcome to the new District Office`
  - Phrase 1: `Pardon our dust while we move in.`
  - Phrase 2: `Scheduling coming soon.`
- **Do not touch** `scheduling-panel/` or `scheduling-backend/`.

## Verification Model — read this before Task 1

**This SDK has no unit-test framework.** `npm test` is a stub (`echo "Error: no test specified" && exit 1`), and `grunt test` just runs `compress`. Adding Karma/Jasmine to a vendored AngularJS 1.x tree would be significant scope creep on code we do not own, and it would not catch the risks that actually matter here — whether the `.vtz` loads on x70 firmware, whether the legacy toolchain builds, and whether the screen looks right on glass. None of those are unit-testable.

So this plan does **not** follow a red-green-refactor cycle, and it does not pretend to. Instead every task ends with:

1. **An automated gate** — `grunt --app=mcccd` must exit `Done, without errors`. `jshint` runs first and fails the build on any lint error, so this is a genuine binary pass/fail on all our JavaScript.
2. **A specific, checkable observation** — an exact thing to look for in the emulator or on glass, written so it can be falsified. "Looks fine" is not an acceptable result; each step states what must be true.

Where logic is genuinely testable in isolation it is trivial (a two-branch page substitution, a modulo increment), so a unit test would be ceremony rather than protection. This is a deliberate, stated deviation from the usual TDD default — not an oversight.

## File Structure

| File | Responsibility |
|---|---|
| `scheduling-ootb/app/**` | Vendored SDK (baseline; our edits are diffs against it) |
| `scheduling-ootb/reference/schedulingproject_1.4.7.zip` | Untouched stock package, for rollback |
| `scheduling-ootb/README.md` | Build + deploy runbook |
| `app/apps/mcccd/` | `--app=` target folder (may stay near-empty; required by `validateApp`) |
| `app/src/js/constants/holdingMode.js` | **New.** Single source of truth: on/off, page name, cadence, copy |
| `app/src/js/services/appState.js` | **Modify.** Gate inside `openPage` |
| `app/src/js/configs/route.js` | **Modify.** `defaultURL` respects holding mode |
| `app/src/js/controllers/holding.js` | **New.** Clock, phrase cycling, screensaver suppression, logo choice |
| `app/src/views/partials/holding.html` | **New.** The screen |
| `app/src/scss/partials/holding.scss` | **New.** Layout + motion |
| `app/src/scss/base.scss` | **Modify.** One `@import` — reaches all three layouts |
| `app/src/assets/images/brand/` | **New.** MCCCD logo set |

**Why `base.scss` and not the three layout entries:** `horizontal.scss`, `vertical.scss` and `portrait.scss` each `@import 'base'`, so a single import there reaches all three. Verified by reading all four files.

**Auto-discovery (verified in `Gruntfile.js`) — no Grunt edits needed:**
- JS: `concat.dist.src = [sourceFolder + '/js/module.js', 'src/js/**/*.js']` picks up new files under `src/js/`.
- Templates: `pug` uses `grunt.file.expand(sourceFolder + '/views/**/**/*.html')`, mapping `src/views/partials/holding.html` → template ID `views/partials/holding.html`, which is exactly what `TemplateService.getPageTemplateUrl('holding')` looks up.
- Assets: `Gruntfile.js:346` copies `<src>/assets` → `<dest>/assets` wholesale.

---

### Task 0: Prove a stock `.vtz` loads on the TSS-1070 (HARDWARE GATE)

**This task gates every other task. If it fails, stop and re-plan — do not start Task 1.**

FRED task: `b3f44c1b`. No code, no toolchain.

**Files:** none.

- [ ] **Step 1: Get Jordan's explicit go-ahead for a panel mode change**

`.104` is currently `Mode=CrestronGeneralWeb`. This route requires switching it back to the scheduling/OOTB mode. That is a real device state change on a customer panel. Ask before touching it.

- [ ] **Step 2: Extract the stock package**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels"
python -c "
import zipfile
z = zipfile.ZipFile('crestron_scheduling_ui_sdk_1.4.7.1.zip')
m = [n for n in z.namelist() if n.endswith('schedulingproject_1.4.7.zip')][0]
open('/c/tmp/schedulingproject_1.4.7.zip','wb').write(z.read(m))
print('extracted', m)
"
```

Expected: `extracted UI_Project/build/schedulingproject_1.4.7.zip`

- [ ] **Step 3: FTP it to the panel's firmware directory and load it**

Upload `/c/tmp/schedulingproject_1.4.7.zip` to the `firmware` directory on `[REDACTED-IP]`, then from the panel text console run:

```
OOTBPROJECTLOAD
```

GUI alternative: Web Configuration → **Actions** → browse to the file.

> Panel SSH console needs paramiko `invoke_shell`, not `exec_command` — recorded in `Project Log.md` v1.2.0.

- [ ] **Step 4: Record the outcome — this is the decision point**

Two possible results, both valuable:

- **Accepted** → the stock Crestron scheduling UI renders on glass. Proceed to Task 1.
- **Rejected** → capture the exact console error. The `Targets=TSW-[REDACTED-DEVICE]` string is **hardcoded** in `Gruntfile.js` in the `makeIni` task, so a contingency exists: change that string to an x70 target and rebuild. But **do not guess a target string** — bring the error back and re-plan.

- [ ] **Step 5: Write the result into the Project Log and close the FRED task**

Record: whether the vtz loaded, the exact panel mode before and after, and the console output. Update FRED task `b3f44c1b` to `review`.

---

### Task 1: Vendor the SDK and prove the stock toolchain builds

**Files:**
- Create: `scheduling-ootb/app/**` (vendored from the SDK zip)
- Create: `scheduling-ootb/reference/schedulingproject_1.4.7.zip`
- Create: `scheduling-ootb/.gitignore`

**Interfaces:**
- Produces: a working `grunt --app=mcccd --dist` build, and `scheduling-ootb/app` as the working directory for all later tasks.

- [ ] **Step 1: Extract the SDK into the repo**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels"
mkdir -p scheduling-ootb/reference
python -c "
import zipfile, pathlib, shutil, os
z = zipfile.ZipFile('crestron_scheduling_ui_sdk_1.4.7.1.zip')
z.extractall('/c/tmp/sdk_extract')
shutil.copytree('/c/tmp/sdk_extract/UI_Project/app', 'scheduling-ootb/app', dirs_exist_ok=True)
shutil.copy('/c/tmp/sdk_extract/UI_Project/build/schedulingproject_1.4.7.zip', 'scheduling-ootb/reference/')
shutil.copy('/c/tmp/sdk_extract/license.txt', 'scheduling-ootb/')
print('ok')
"
```

Expected: `ok`

- [ ] **Step 2: Remove the SDK's prebuilt output (regenerable, 4 MB+)**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb"
rm -rf app/dist
printf 'node_modules/\nbower_components/\npublic/\ndist/\n' > .gitignore
ls app
```

Expected listing includes `src`, `apps`, `vendor`, `back`, `Gruntfile.js`, `package.json` — and **no** `dist`.

- [ ] **Step 3: Create the `--app=` target folder**

`validateApp()` throws `Error: Can not find subfolder mcccd in folder apps` without this.

```bash
mkdir -p app/apps/mcccd
printf 'MCCCD District Office holding panel build target.\n' > app/apps/mcccd/README.md
```

- [ ] **Step 4: Install dependencies**

```bash
cd app
npm install -g bower grunt-cli
npm install
```

Expected: completes and creates `node_modules/` and `bower_components/`. `postinstall` runs `bower install`.

> If `bower install` fails, that is the known friction point. Run `bower install --allow-root` or install the `bower.json` deps manually into `bower_components/`. Do **not** skip it — `buildInfo.json` copies from `bower_components/` and the build produces a broken `index.html` without them.

- [ ] **Step 5: Build the STOCK app, unmodified — the toolchain gate**

```bash
grunt --app=mcccd --dist
```

Expected: ends with `Done, without errors.`

- [ ] **Step 6: Verify the package shape**

```bash
python -c "
import zipfile, glob
f = glob.glob('dist/mcccd_*.zip') + glob.glob('../build/mcccd_*.zip')
print('packages:', f)
z = zipfile.ZipFile(f[0])
print(z.namelist())
print(z.read('~info.ini').decode())
"
```

Expected: exactly two entries — `mcccd_1.4.7.001.vtz` and `~info.ini` — and the ini reads:

```
[Firmware]
Filename=mcccd_1.4.7.001.vtz
Version=1.4.7.001
Targets=TSW-[REDACTED-DEVICE]
```

- [ ] **Step 7: Verify the emulator runs the stock UI**

```bash
grunt --app=mcccd --debug --emulate
node server.js
```

Open `http://localhost:3000`. Expected: the **stock Crestron scheduling UI** with an emulated calendar — a room status screen with a timeline, not a blank page. This confirms the emulator harness works *before* we change anything, so later failures are unambiguously ours.

- [ ] **Step 8: Commit**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels"
git add scheduling-ootb
git commit -m "feat(ootb): vendor Crestron Scheduling UI SDK 1.4.7.1 and verify stock build"
```

---

### Task 2: Holding-mode constant and the navigation gate

**Files:**
- Create: `scheduling-ootb/app/src/js/constants/holdingMode.js`
- Modify: `scheduling-ootb/app/src/js/services/appState.js` (`$inject` list, function params, `createMethods`)
- Modify: `scheduling-ootb/app/src/js/configs/route.js`

**Interfaces:**
- Produces: `HoldingMode` Angular constant — `{enabled: boolean, page: string, phraseIntervalMs: number, interceptedPages: string[], copy: {<lang>: {greeting: string, phrases: string[]}}}`. Consumed by Task 3's controller and by `route.js`.

- [ ] **Step 1: Create the constant**

Create `scheduling-ootb/app/src/js/constants/holdingMode.js`:

```javascript
/**
 * Holding Mode
 *
 * Single source of truth for the MCCCD District Office holding screen.
 * Set `enabled` to false to restore the stock scheduling application.
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .constant('HoldingMode', {
            // Master switch. false => stock scheduling app, unmodified behaviour.
            enabled: true,

            // Page name registered at views/partials/<page>.html
            page: 'holding',

            // Pages redirected to the holding screen while enabled.
            interceptedPages: ['room', 'screensaver'],

            // Cross-fade cadence for the message slot, milliseconds.
            phraseIntervalMs: 8000,

            // Site-specific copy. Keyed by two-letter language, 'en' is the fallback.
            // Deliberately NOT in assets/translations/*.json - that is product UI
            // text across ~30 files; this is one site's signage.
            copy: {
                en: {
                    greeting: 'Welcome to the new District Office',
                    phrases: [
                        'Pardon our dust while we move in.',
                        'Scheduling coming soon.'
                    ]
                }
            }
        });
})();
```

- [ ] **Step 2: Add `HoldingMode` to the `AppStateService` injection list**

In `scheduling-ootb/app/src/js/services/appState.js`, the `$inject` array currently ends:

```javascript
    'BackgroundService',
    'AppClockService',
  ];
```

Change to:

```javascript
    'BackgroundService',
    'AppClockService',
    'HoldingMode',
  ];
```

- [ ] **Step 3: Add the matching function parameter**

The factory signature `function AppStateService(...)` lists parameters in the same order. Find the parameter that matches `AppClockService` and add `HoldingMode` immediately after it.

> **Order matters.** AngularJS matches `$inject` entries to parameters positionally. If the new parameter is not last in *both* lists, every injected service after it shifts and the app breaks at runtime with confusing errors.

- [ ] **Step 4: Gate `openPage`**

In `this.createMethods`, replace:

```javascript
      $rootScope.Helium.methods.openPage = function (page) {
        if (readyStart) $location.path('/page/' + page);
      };
```

with:

```javascript
      $rootScope.Helium.methods.openPage = function (page) {
        var target = page;

        // Holding mode: funnel the scheduling screens to the holding page.
        // Single chokepoint - 'room' is otherwise requested from four places.
        if (HoldingMode.enabled && HoldingMode.interceptedPages.indexOf(page) !== -1) {
          target = HoldingMode.page;
        }

        if (readyStart) $location.path('/page/' + target);
      };
```

- [ ] **Step 5: Make the route default respect holding mode**

In `scheduling-ootb/app/src/js/configs/route.js`, change the injection line:

```javascript
	routeConfig.$inject = ['$routeProvider'];
```

to:

```javascript
	routeConfig.$inject = ['$routeProvider', 'HoldingMode'];
```

then the function signature:

```javascript
	function routeConfig($routeProvider, HoldingMode) {
		var url = null,
			defaultURL = HoldingMode.enabled
				? 'views/partials/' + HoldingMode.page + '.html'
				: 'views/partials/room.html';
```

> Angular `constant()` values — unlike `value()` or services — are available during the config phase, so this injection is legal.

- [ ] **Step 6: Create a placeholder template so the route resolves**

`TemplateService.getPageTemplateUrl` returns `null` unless the template is in `$templateCache`, and the route silently falls back. Create the minimum now; Task 3 fills it in.

Create `scheduling-ootb/app/src/views/partials/holding.html`:

```html
<div class="holding bg__theme-color-2" data-ng-controller="HoldingCtrl">
    <div class="holding__greeting color__theme-color-5">{{ greeting }}</div>
</div>
```

And `scheduling-ootb/app/src/js/controllers/holding.js`:

```javascript
/**
 * Holding screen controller
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .controller('HoldingCtrl', HoldingCtrl);

    HoldingCtrl.$inject = ['$scope', 'HoldingMode'];

    function HoldingCtrl($scope, HoldingMode) {
        $scope.greeting = HoldingMode.copy.en.greeting;
    }
})();
```

- [ ] **Step 7: Build — the jshint gate**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb/app"
grunt --app=mcccd --dist
```

Expected: `Done, without errors.` A lint error here fails the build — fix it, do not add `--debug` to mask it.

- [ ] **Step 8: Verify the gate actually redirects**

```bash
grunt --app=mcccd --debug --emulate
node server.js
```

Open `http://localhost:3000`. Expected, in order:
1. Splash screen appears (unchanged — `run.js` calls `$location.path('page/splash')` directly, bypassing `openPage`).
2. It then lands on a mostly-empty page showing **`Welcome to the new District Office`** — *not* the stock room/timeline screen.
3. Browser URL ends in `#/page/holding`.

If you see the stock room screen, the gate is not firing — check the `$inject`/parameter ordering from Step 3.

- [ ] **Step 9: Verify the off-switch**

Set `enabled: false` in `holdingMode.js`, rebuild with `grunt --app=mcccd --debug --emulate`, reload. Expected: the **stock scheduling UI** returns. Set it back to `true`.

This is the phase-2 exit path — prove it works now, while it is cheap to fix.

- [ ] **Step 10: Commit**

```bash
git add scheduling-ootb/app/src
git commit -m "feat(ootb): add holding-mode gate at the openPage chokepoint"
```

---

### Task 3: The holding screen — room name, clock, phrase cycling

**Files:**
- Modify: `scheduling-ootb/app/src/js/controllers/holding.js`
- Modify: `scheduling-ootb/app/src/views/partials/holding.html`

**Interfaces:**
- Consumes: `HoldingMode` (Task 2).
- Produces: scope properties `greeting`, `phrases`, `phraseIndex`, `now`, `roomName`, `isImpair`, and `logoSrc` (Task 4 fills `logoSrc`).

- [ ] **Step 1: Write the controller**

Replace `scheduling-ootb/app/src/js/controllers/holding.js` entirely:

```javascript
/**
 * Holding screen controller
 *
 * Everything on this screen comes from the panel itself - room name, clock
 * format and theme all arrive on the 'config' channel. Nothing is hardcoded
 * except the site copy in HoldingMode.
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .controller('HoldingCtrl', HoldingCtrl);

    HoldingCtrl.$inject = [
        '$rootScope',
        '$scope',
        '$interval',
        'HoldingMode',
        'AppClockService',
        'AppStateService'
    ];

    function HoldingCtrl($rootScope, $scope, $interval, HoldingMode, AppClockService, AppStateService) {
        var phraseTimer = null,
            settings = $rootScope.Helium.settings || {},
            room = settings.room || {},

            resolveCopy = function () {
                var lang = (room.language || 'en').toLowerCase().slice(0, 2);
                return HoldingMode.copy[lang] || HoldingMode.copy.en;
            },

            tick = function () {
                $scope.now = new Date();
            };

        var copy = resolveCopy();

        $scope.greeting = copy.greeting;
        $scope.phrases = copy.phrases;
        $scope.phraseIndex = 0;
        $scope.roomName = $rootScope.Helium.values ? $rootScope.Helium.values.roomName : '';
        $scope.isImpair = $rootScope.Helium.state.theme === 'impair-theme';

        // Date/time formats are normalised by SettingsService from the panel's
        // own 12/24h and date-order configuration.
        $scope.timeFormat = room.timeFormat || 'h:mm a';
        $scope.dateFormat = room.dateFormat || 'fullDate';

        // The holding screen IS the permanent view - the stock screensaver
        // would cover it. Burn-in is handled by CSS motion instead.
        AppStateService.stopScreensaverTimeout();

        // Shared minute-resolution ticker. Do not add another timer.
        tick();
        AppClockService.subscribe(tick);

        // Cross-fade the message slot. Suppressed under impair-theme, which
        // ships for low-vision users - motion works against that need.
        if (!$scope.isImpair && $scope.phrases.length > 1) {
            phraseTimer = $interval(function () {
                $scope.phraseIndex = ($scope.phraseIndex + 1) % $scope.phrases.length;
            }, HoldingMode.phraseIntervalMs);
        }

        $scope.$on('$destroy', function () {
            AppClockService.unsubscribe(tick);
            if (phraseTimer) {
                $interval.cancel(phraseTimer);
                phraseTimer = null;
            }
        });
    }
})();
```

- [ ] **Step 2: Write the template**

Replace `scheduling-ootb/app/src/views/partials/holding.html` entirely:

```html
<div class="holding bg__theme-color-2" data-ng-controller="HoldingCtrl">
    <div class="holding__drift">

        <div class="holding__logo">
            <img class="holding__logo-img" data-ng-src="{{ logoSrc }}" alt="Maricopa Community Colleges" />
        </div>

        <div class="holding__greeting color__theme-color-5">{{ greeting }}</div>

        <div class="holding__message" data-ng-class="{ 'is-static': isImpair }">
            <div class="holding__phrase color__theme-color-4"
                 data-ng-repeat="phrase in phrases track by $index"
                 data-ng-class="{ 'is-active': $index === phraseIndex, 'is-static': isImpair }">{{ phrase }}</div>
        </div>

        <div class="holding__footer">
            <div class="holding__room color__theme-color-4">{{ roomName }}</div>
            <div class="holding__clock color__theme-color-5">{{ now | date:timeFormat }}</div>
            <div class="holding__date color__theme-color-4">{{ now | date:dateFormat }}</div>
        </div>

    </div>
</div>
```

> `color__theme-color-5` is full-opacity foreground and `color__theme-color-4` is 80% — both generated by `scss/utils/colors.scss` for **all three** themes, so the screen re-colours automatically. Verified by reading that file.

- [ ] **Step 3: Build — jshint gate**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb/app"
grunt --app=mcccd --dist
```

Expected: `Done, without errors.`

- [ ] **Step 4: Verify in the emulator**

```bash
grunt --app=mcccd --debug --emulate
node server.js
```

Open `http://localhost:3000`. Expected, all of which must be true:
- The greeting reads exactly `Welcome to the new District Office`.
- A clock shows the **current** time, matching your system clock to the minute.
- A date is rendered (exact format depends on the emulated `dateFormat`).
- Both phrases are present in the DOM (they will overlap without styling — Task 5 fixes that).
- After ~8 seconds, `phraseIndex` advances. Confirm in devtools console:

```javascript
angular.element(document.querySelector('.holding')).scope().phraseIndex
```

Expected: `0`, then `1` after ~8 s, then back to `0`.

- [ ] **Step 5: Verify no screensaver**

Leave the emulator open for longer than the emulated `idleTimeoutMinutes` (1 minute in `appInfoEmu.json`). Expected: the holding screen stays up; the stock screensaver never appears.

- [ ] **Step 6: Commit**

```bash
git add scheduling-ootb/app/src
git commit -m "feat(ootb): holding screen with panel room name, clock and phrase cycling"
```

---

### Task 4: MCCCD branding — theme- and layout-aware logo

**Files:**
- Create: `scheduling-ootb/app/src/assets/images/brand/*.png` (4 files)
- Modify: `scheduling-ootb/app/src/js/controllers/holding.js`

**Interfaces:**
- Consumes: `$rootScope.Helium.state.layout`, `$rootScope.Helium.state.theme`.
- Produces: `$scope.logoSrc`, already bound by the Task 3 template.

- [ ] **Step 1: Extract the four logo variants**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels"
mkdir -p scheduling-ootb/app/src/assets/images/brand
python -c "
import zipfile
z = zipfile.ZipFile('Logos/MCCCD/maricopa-logos.zip')
want = {
 'District_Office/Horizontal/White/Logo_WHITE_MCCCD_Horizontal.png': 'logo-horizontal-white.png',
 'District_Office/Horizontal/Black/Logo_BLACK_MCCCD_Horizontal.png': 'logo-horizontal-black.png',
 'District_Office/Vertical/White/Logo_WHITE_MCCCD_Stacked.png':      'logo-stacked-white.png',
 'District_Office/Vertical/Black/Logo_BLACK_MCCCD_Stacked.png':      'logo-stacked-black.png',
}
for src, dst in want.items():
    open('scheduling-ootb/app/src/assets/images/brand/' + dst, 'wb').write(z.read(src))
    print('ok', dst)
"
```

Expected: four `ok` lines. Source paths verified against the archive.

- [ ] **Step 2: Add logo resolution to the controller**

In `scheduling-ootb/app/src/js/controllers/holding.js`, add this helper inside `HoldingCtrl` alongside `resolveCopy`:

```javascript
            resolveLogo = function () {
                var state = $rootScope.Helium.state || {},
                    stacked = state.layout === 'vertical' || state.layout === 'portrait',
                    // White logo on every DARK theme. impair-theme is dark
                    // (bg $theme-color-2 = black, fg $theme-color-9 = white),
                    // same as dark-theme - only light-theme needs black.
                    // Also fails safe: unknown theme -> white on dark bg.
                    white = state.theme !== 'light-theme';

                return 'assets/images/brand/logo-' +
                    (stacked ? 'stacked' : 'horizontal') + '-' +
                    (white ? 'white' : 'black') + '.png';
            },
```

Then set it alongside the other scope assignments:

```javascript
        $scope.logoSrc = resolveLogo();
```

- [ ] **Step 3: Build — jshint gate**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb/app"
grunt --app=mcccd --dist
```

Expected: `Done, without errors.`

- [ ] **Step 4: Confirm the assets shipped into the package**

```bash
python -c "
import zipfile, glob
z = zipfile.ZipFile(glob.glob('dist/mcccd_*.zip')[0])
v = zipfile.ZipFile(__import__('io').BytesIO(z.read([n for n in z.namelist() if n.endswith('.vtz')][0])))
print([n for n in v.namelist() if 'brand' in n])
"
```

Expected: all four `assets/images/brand/logo-*.png` paths listed. This proves the `src/assets` → `dest/assets` copy worked with no Grunt change.

- [ ] **Step 5: Verify logo swapping in the emulator**

```bash
grunt --app=mcccd --debug --emulate
node server.js
```

The emulated config sets `theme: "light-theme"` and `verticalOrientation: false`, so expect **`logo-horizontal-black.png`**. Confirm in devtools:

```javascript
document.querySelector('.holding__logo-img').getAttribute('src')
```

Then force the dark theme in the console and confirm the source changes:

```javascript
var s = angular.element(document.querySelector('.holding')).scope();
angular.element(document.body).injector().get('$rootScope').Helium.state.theme = 'dark-theme';
```

Reload. Expected: `logo-horizontal-white.png`.

- [ ] **Step 6: Commit**

```bash
git add scheduling-ootb/app/src
git commit -m "feat(ootb): MCCCD branding with theme- and layout-aware logo selection"
```

---

### Task 5: Styling and burn-in motion

**Files:**
- Create: `scheduling-ootb/app/src/scss/partials/holding.scss`
- Modify: `scheduling-ootb/app/src/scss/base.scss` (one `@import`)

- [ ] **Step 1: Write the stylesheet**

Create `scheduling-ootb/app/src/scss/partials/holding.scss`:

```scss
// MCCCD District Office holding screen.
//
// Motion is restricted to `transform` and `opacity` - both compositor-only.
// This runs 24/7 on an Android WebView in a wall enclosure, so anything that
// forces layout or paint every frame is off-limits.

.holding {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
}

// Layer 1: global pixel-shift. The burn-in guarantee - it moves EVERY element,
// including the logo, regardless of what the text is doing.
.holding__drift {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    // vh/vw, not %: percentage padding resolves against WIDTH on BOTH axes
    // while translateY() resolves against HEIGHT, which clipped in portrait.
    padding: 5vh 5vw;

    will-change: transform;
    animation: holding-drift 240s ease-in-out infinite;
}

@keyframes holding-drift {
    0%   { transform: translate(-3%, -3%); }
    25%  { transform: translate( 3%, -2%); }
    50%  { transform: translate( 3%,  3%); }
    75%  { transform: translate(-2%,  3%); }
    100% { transform: translate(-3%, -3%); }
}

.holding__logo {
    margin-bottom: 4vh;
}

.holding__logo-img {
    max-width: 46vw;
    max-height: 18vh;
    width: auto;
    height: auto;
}

.holding__greeting {
    text-align: center;
    font-size: 4.4vh;
    line-height: 1.2;
    margin-bottom: 3vh;
}

// Layer 2: the message slot. Phrases stack on top of each other and
// cross-fade, so the slot never changes height and nothing reflows.
.holding__message {
    position: relative;
    width: 80%;
    height: 9vh;
    margin-bottom: 5vh;
}

.holding__phrase {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    text-align: center;
    font-size: 3vh;
    line-height: 1.3;

    opacity: 0;
    transition: opacity 1.2s ease-in-out;

    &.is-active {
        opacity: 1;
    }

    // Accessibility: impair-theme ships for low-vision users. Show every
    // phrase at once, statically, and never fade.
    &.is-static {
        position: relative;
        opacity: 1;
        transition: none;
        margin-bottom: 1vh;
    }
}

// Impair layout: the slot grows to fit every phrase at once.
// Driven by ng-class on the container, NOT by `:has()` - the panel runs an
// older Android WebView and `:has()` support cannot be assumed.
.holding__message.is-static {
    height: auto;
}

.holding__footer {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.holding__room {
    font-size: 2.6vh;
    margin-bottom: 0.6vh;
}

.holding__clock {
    font-size: 7vh;
    line-height: 1;
}

.holding__date {
    font-size: 2.4vh;
    margin-top: 0.6vh;
}
```

- [ ] **Step 2: Import it once, reaching all three layouts**

In `scheduling-ootb/app/src/scss/base.scss`, find:

```scss
@import "partials/offline";
@import "partials/screensaver";
```

and add below:

```scss
@import "partials/holding";
```

> `horizontal.scss`, `vertical.scss` and `portrait.scss` each `@import 'base'`, so this single line covers every orientation.

- [ ] **Step 3: Build — jshint and sass gate**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb/app"
grunt --app=mcccd --dist
```

Expected: `Done, without errors.` A Sass syntax error fails here.

- [ ] **Step 4: Confirm the styles compiled into all three layouts**

```bash
grep -c "holding__drift" dist/mcccd/horizontal.min.css dist/mcccd/vertical.min.css dist/mcccd/portrait.min.css
```

Expected: a non-zero count for **all three** files. A zero means the `base.scss` import did not take.

- [ ] **Step 5: Verify on screen**

```bash
grunt --app=mcccd --debug --emulate
node server.js
```

At `http://localhost:3000`, expected:
- Logo, greeting, one visible phrase, room name, clock and date are vertically centred and do not overlap.
- Exactly **one** phrase is visible at a time; after ~8 s it cross-fades to the other over about a second.
- Nothing overflows the viewport and no scrollbar appears.

- [ ] **Step 6: Verify the drift is real, not imagined**

In devtools, run:

```javascript
getComputedStyle(document.querySelector('.holding__drift')).transform
```

Wait ~30 seconds and run it again. Expected: a **different** matrix. Identical values mean the animation is not running.

- [ ] **Step 7: Verify the impair-theme accessibility path**

In devtools:

```javascript
var $r = angular.element(document.body).injector().get('$rootScope');
$r.Helium.state.theme = 'impair-theme';
$r.$apply();
```

Reload. Expected: **both** phrases visible simultaneously and static, with no cross-fade. The `.holding__drift` animation must still be running (re-check Step 6).

- [ ] **Step 8: Verify the vertical and portrait layouts visually**

Compiled-CSS presence (Step 4) is not proof the screen *looks* right rotated. Force each layout and check.

In devtools:

```javascript
var $r = angular.element(document.body).injector().get('$rootScope');
$r.Helium.state.layout = 'vertical';
$r.$apply();
```

Then resize the browser window to a portrait aspect ratio (e.g. 800×1280) to approximate the rotated panel, and reload.

Expected, for `vertical` and again for `portrait`:
- The **stacked** logo is used (`logo-stacked-*.png`), not the horizontal lockup.
- Nothing overflows; no scrollbar; the clock and greeting stay legible.
- The drift animation still runs (re-check Step 6).

Reset to `horizontal` when done.

- [ ] **Step 9: Commit**

```bash
git add scheduling-ootb/app/src/scss
git commit -m "feat(ootb): holding screen styling with pixel-shift and cross-fade motion"
```

---

### Task 6: Package, deploy and document

**Files:**
- Create: `scheduling-ootb/README.md`
- Modify: `Project Log.md`
- Modify: `scheduling-ootb/app/src/appInfo.json`

- [ ] **Step 1: Give the build its own version**

Edit `scheduling-ootb/app/src/appInfo.json`:

```json
{
    "main": "index.html",
    "title": "MCCCD District Office scheduling panel",
    "version": "1.5.0"
}
```

> **Use a 3-segment version.** `Gruntfile.js`'s `findAppVersion()` truncates any
> version with more than 3 segments to its first three — so stock `1.4.7.001`
> builds as `1.4.7`, and a 4-segment `1.4.7.100` would *also* collapse to
> `1.4.7`, colliding with stock and defeating this step. `1.5.0` passes through
> untouched. Verified by reading `findAppVersion()` in the vendored Gruntfile.

- [ ] **Step 2: Build the deliverable**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels/scheduling-ootb/app"
grunt --app=mcccd --dist
```

Expected: `Done, without errors.`, producing `dist/mcccd_1.5.0.zip` (also copied to `scheduling-ootb/build/`).

- [ ] **Step 3: Verify the package one final time**

```bash
python -c "
import zipfile, glob
p = glob.glob('dist/mcccd_1.5.0.zip')[0]
z = zipfile.ZipFile(p)
print(sorted(z.namelist()))
print(z.read('~info.ini').decode())
"
```

Expected: exactly `['mcccd_1.5.0.vtz', '~info.ini']`, with `Filename=mcccd_1.5.0.vtz` and `Version=1.5.0`.

- [ ] **Step 4: Deploy to `[REDACTED-IP]`**

Same mechanism proven in Task 0: FTP `mcccd_1.5.0.zip` to the panel's `firmware` directory, then run `OOTBPROJECTLOAD`.

- [ ] **Step 5: Verify on glass — the real acceptance test**

All of these must hold:
- The room name shown matches the panel's configured `settings.room.name` (**not** a hardcoded string).
- The clock matches wall time to the minute.
- Phrases cross-fade on roughly an 8-second cadence.
- **No scheduling control is reachable by touch** — try tapping everywhere.
- The screensaver never appears.
- The light bar behaves exactly as stock (nothing in this build calls `setLED*`).

- [ ] **Step 6: Overnight soak**

Leave it running overnight. Next morning check: no visible stutter, no drifting-out-of-bounds content, clock still correct, panel not hot. Burn-in mitigation cannot be validated in an afternoon, but a soak catches animation leaks and clock drift.

- [ ] **Step 7: Write the runbook**

Create `scheduling-ootb/README.md` covering, in this order: prerequisites (Node 20, `bower`, `grunt-cli`); the three build commands and what each is for; the emulator workflow; the deploy procedure; **rollback** (reload `reference/schedulingproject_1.4.7.zip`); how to turn holding mode off for phase 2 (`enabled: false` in `holdingMode.js`); and where to change the copy. Link the spec and FRED doc `1e4135fc`.

- [ ] **Step 8: Update the Project Log and FRED**

Append a `v1.3.0` entry to `Project Log.md` recording: the OOTB route decision and why it beats the blocked kiosk route, the Task 0 result, the panel mode change on `.104`, and the deployed version. Move FRED tasks `0f3fd35f`, `4e1c46a0`, `53001291` to `review`.

- [ ] **Step 9: Commit**

```bash
cd "/c/Users/scale/CascadeProjects/Crestron Scheduling Panels/Alpha one Schedule panels"
git add scheduling-ootb "Project Log.md"
git commit -m "feat(ootb): package MCCCD holding panel v1.5.0 and document build/deploy"
```

---

## Contingency: Task 0 fails

If the panel rejects the stock `.vtz`, capture the exact console error, then consider in order:

1. **Target string.** `Targets=TSW-[REDACTED-DEVICE]` is hardcoded in `Gruntfile.js`'s `makeIni` task and is therefore editable — but only change it to a value confirmed from Crestron documentation or a panel-side error message. **Do not guess.**
2. **Version check.** Compare SDK 1.4.7 against the OOTB app version actually installed on `.104` (`statusScreenInfo` / Web Config). A large gap may mean a newer SDK exists.
3. **Fall back** to the hand-authored `.vtz` (spec §3, option B) or return to the kiosk route, which then makes blocker `edc132ad` critical-path again.

Update the spec and this plan before proceeding down any of these — do not improvise on hardware.
