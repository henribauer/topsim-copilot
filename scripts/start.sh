#!/bin/sh
# TOPSIM Copilot: start the local server if it is not running, then open the app in the browser.
# Same pattern as the Pressespiegel launcher: a running server is never restarted.
# Called by the desktop app (scripts/launcher.applescript); also works from a terminal.
set -u
PORT=5181
URL="http://127.0.0.1:$PORT/"
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${TMPDIR:-/tmp}/topsim-copilot.log"

# Finder-started apps get a minimal PATH, so look for node in the known places.
NODE=""
for n in "$HOME/.hermes/tools/node-26.7.0-darwin-arm64/bin/node" /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node 2>/dev/null)"; do
  if [ -n "$n" ] && [ -x "$n" ]; then NODE="$n"; break; fi
done
[ -z "$NODE" ] && { echo "node not found" >&2; exit 2; }
[ -f "$PROJ/node_modules/vite/bin/vite.js" ] || { echo "node_modules missing in $PROJ - run ~/claude/link-local-deps.sh" >&2; exit 3; }

if ! /usr/bin/curl -s -o /dev/null --max-time 1 "$URL"; then
  cd "$PROJ" || exit 4
  # Detach stdin/stdout, otherwise AppleScript's "do shell script" never returns.
  nohup "$NODE" node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG" 2>&1 </dev/null &
  i=0
  until /usr/bin/curl -s -o /dev/null --max-time 1 "$URL"; do
    i=$((i + 1))
    [ "$i" -ge 40 ] && { echo "server did not start, see $LOG" >&2; exit 5; }
    sleep 0.5
  done
fi
[ "${NO_OPEN:-}" = 1 ] || /usr/bin/open "$URL"
echo "running: $URL"
