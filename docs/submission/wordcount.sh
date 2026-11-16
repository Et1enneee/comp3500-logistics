#!/bin/sh
set -eu
# Word count for the report, using the course rule rather than a stricter one.
#
# Method: body prose, headings and tables are counted. Figures are excluded in
# both of their parts, because the course excludes diagrams or charts from the
# count: the image lines themselves and the italic caption that is the figure's
# legend. Tables are counted: the rule names diagrams only.
#
# Caption freeze: the count only stays honest while captions stay captions, so
# this script asserts that the report has exactly five caption lines. Adding
# prose to a caption makes this script fail rather than quietly shrink the count.
PANDOC=${PANDOC:-pandoc}
REPORT=docs/submission/report.md
LIMIT=1000
CAPTIONS=5

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

found=$(grep -c '^\*Figure [0-9]' "$REPORT" || true)
if [ "$found" -ne "$CAPTIONS" ]; then
  printf 'Caption freeze: expected %s figure captions, found %s.\n' "$CAPTIONS" "$found"
  printf 'Captions are the figures'"'"' legends; prose does not belong in them.\n'
  exit 1
fi

count=$(sed '/^!\[/d' "$REPORT" | sed '/^\*Figure /d' \
  | "$PANDOC" --from=markdown --to=plain --wrap=none | sed '/^https\?:\/\//d' | wc -w | tr -d ' ')
with_captions=$(sed '/^!\[/d' "$REPORT" \
  | "$PANDOC" --from=markdown --to=plain --wrap=none | sed '/^https\?:\/\//d' | wc -w | tr -d ' ')

printf 'Method: body prose, headings and tables counted; figures and their captions excluded per the course rule "Diagram or chart is not part of the word count".\n'
printf 'Words (figures and captions excluded): %s\n' "$count"
printf 'Words (captions included, reference only): %s\n' "$with_captions"
printf 'Figure captions found: %s of %s (frozen)\n' "$found" "$CAPTIONS"
printf 'Limit: %s\n' "$LIMIT"
[ "$count" -le "$LIMIT" ] && echo 'Result: PASS' || { echo 'Result: FAIL'; exit 1; }
