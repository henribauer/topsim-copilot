#!/bin/sh
# Pre-commit secret scan. Exits 1 (and so stops the commit) on anything shaped like a credential.
# Matches token *formats*, not the word "token", so parser variables like `tokens` don't trip it.
# Install once per clone: ln -sf ../../scripts/secret-scan.sh .git/hooks/pre-commit
PATTERN='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api[_-]?key|secret|password|token)["'\'']?[[:space:]]*[:=][[:space:]]*["'\''][A-Za-z0-9_/+=-]{16,}["'\'']'
HITS=$(git diff --cached -U0 --no-color | grep -E '^\+' | grep -v '^+++' | grep -v 'PATTERN=' | grep -nE "$PATTERN")
if [ -n "$HITS" ]; then
  echo "secret-scan: possible credential in staged changes — commit stopped:" >&2
  echo "$HITS" | cut -c1-120 >&2
  exit 1
fi
echo "secret-scan: clean"
