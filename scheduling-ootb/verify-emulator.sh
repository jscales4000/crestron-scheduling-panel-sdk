#!/usr/bin/env bash
# Build the emulator bundle, serve it, and capture a headless screenshot.
#
# Usage:  bash scheduling-ootb/verify-emulator.sh <output-name> [url-path]
# Example: bash scheduling-ootb/verify-emulator.sh holding-light
#
# Writes /c/tmp/shot/<output-name>.png
#
# WHY THIS EXISTS - two traps this avoids, both hit for real during Task 1:
#
#  1. PORT COLLISION. An unrelated app on this machine listens on [::1]:3000.
#     The SDK's server.js binds 0.0.0.0 (IPv4 only), and Windows resolves
#     "localhost" to ::1 FIRST - so http://localhost:3000 silently serves the
#     WRONG APPLICATION. A screenshot taken that way showed a completely
#     different product and looked plausible. Always use an unusual port AND
#     the literal 127.0.0.1, never "localhost".
#
#  2. HEADLESS CHROME NEEDS --user-data-dir. Without it the screenshot write
#     fails with "Access is denied" and Chrome still exits 0.

set -euo pipefail

NAME="${1:?usage: verify-emulator.sh <output-name> [url-path]}"
URLPATH="${2:-/}"
PORT=3177
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/app" && pwd)"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
SHOTDIR="/c/tmp/shot"

mkdir -p "$SHOTDIR"
cd "$APP_DIR"

echo "==> building emulator bundle"
grunt --app=mcccd --debug --emulate 2>&1 | tail -3

echo "==> starting server on 127.0.0.1:$PORT"
HOST_PORT=$PORT HOST_ADDRESS=127.0.0.1 node server.js > /c/tmp/emuserver.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 3

# Fail loudly rather than screenshotting whatever happens to answer.
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$URLPATH")
[ "$CODE" = "200" ] || { echo "FAIL: http $CODE from 127.0.0.1:$PORT$URLPATH"; exit 1; }
curl -s "http://127.0.0.1:$PORT$URLPATH" | grep -q '<title>Helium</title>' \
  || { echo "FAIL: served page is not the Helium app - wrong server on $PORT?"; exit 1; }

echo "==> capturing $SHOTDIR/$NAME.png"
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="$SHOTDIR/profile" --hide-scrollbars \
  --virtual-time-budget=15000 --window-size=1280,800 \
  --screenshot="$SHOTDIR/$NAME.png" "http://127.0.0.1:$PORT$URLPATH" 2>&1 | tail -1

ls -l "$SHOTDIR/$NAME.png"
