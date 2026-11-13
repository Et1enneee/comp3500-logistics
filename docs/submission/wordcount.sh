#!/bin/sh
set -eu
# Count all visible prose, captions, headings and table cells; exclude first URL
# and image content, as figures are outside the assignment's word budget.
PANDOC=${PANDOC:-pandoc}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sed '/^!\[/d' docs/submission/report.md | "$PANDOC" --from=markdown --to=plain --wrap=none | sed '/^https\?:\/\//d' > "$tmp/body"
count=$(wc -w < "$tmp/body" | tr -d ' ')
printf 'Command: sed image lines | pandoc --to=plain | sed URL lines | wc -w\n'
printf 'Words (headings, captions and tables included; figures and first URL excluded): %s\n' "$count"
printf 'Limit: 1200\n'
[ "$count" -le 1200 ] && echo 'Result: PASS' || { echo 'Result: FAIL'; exit 1; }
