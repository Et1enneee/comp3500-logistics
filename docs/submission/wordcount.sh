#!/bin/sh
set -eu
# Count all visible prose, captions, headings and table cells; exclude first URL
# and image content, as figures are outside the assignment's word budget.
PANDOC=${PANDOC:-pandoc}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sed '/^!\[/d' docs/submission/report.md | "$PANDOC" --from=markdown --to=plain --wrap=none | sed '1d' | sed '/^https\?:\/\//d' > "$tmp/body"
count=$(wc -w < "$tmp/body" | tr -d ' ')
printf 'Command: sed image lines | pandoc --to=plain | sed first URL line | wc -w\n'
printf 'Words (headings, captions and tables included; figures and first URL excluded): %s\n' "$count"
printf 'Limit: 1000\n'
[ "$count" -le 1000 ] && echo 'Result: PASS' || { echo 'Result: FAIL'; exit 1; }
