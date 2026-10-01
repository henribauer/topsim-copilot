#!/bin/bash
# Mobbin research through the claude CLI (Max subscription, Mobbin connector). Usage:
#   scripts/mobbin.sh <slug> "<what to look for, in plain words>" [web|ios]
# Writes docs/mobbin/<slug>.json: real Mobbin screens plus the layout decision each one supports, so design-guide
# rules can cite a source (nothing invented). Several can run in parallel (xargs -P).
# The prompt goes in on stdin because --allowedTools is variadic and would swallow a positional prompt.
set -euo pipefail
slug="$1"; query="$2"; platform="${3:-web}"
out="$(cd "$(dirname "$0")/.." && pwd)/docs/mobbin"
mkdir -p "$out"
cd "${TMPDIR:-/tmp}"
raw="$(mktemp)"
claude -p --model sonnet --no-session-persistence --output-format json --allowedTools "mcp__claude_ai_Mobbin" > "$raw" <<EOF
Use the Mobbin search_screens tool (platform $platform) to look for: $query.
From the returned screens pick the 4 that best show a CLEAR, UNCLUTTERED layout for this. Reply with ONLY a JSON array, no prose. Items:
{"app": str, "screen": str, "url": the mobbin.com/screens URL, "layout": one sentence on how the screen is structured (what is the hero, what is secondary, how things are grouped), "take": one sentence on what to copy for a glanceable, not-overwhelming UI}
EOF
python3 - "$raw" "$out/$slug.json" "$slug" <<'PY'
import json, re, sys
raw, dest, slug = sys.argv[1:4]
result = json.load(open(raw))["result"]
items = json.loads(re.search(r"\[.*\]", result, re.S).group(0))
json.dump(items, open(dest, "w"), indent=2, ensure_ascii=False)
print(f"{slug}: {len(items)} screens")
PY
rm -f "$raw"
