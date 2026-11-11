#!/bin/sh
set -eu
# Run at repository root. Pandoc text includes image alt text and captions;
# the SVG labels are added as well, deliberately counting diagrams conservatively.
PANDOC=${PANDOC:-pandoc}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
"$PANDOC" --from=markdown --to=plain --wrap=none docs/submission/report.md | sed '1d' | sed '/^https\?:\/\//d' > "$tmp/body"
python3 - "$tmp/figures" <<'PY'
import re, sys, xml.etree.ElementTree as ET
from pathlib import Path
s=Path('docs/submission/report.md').read_text(encoding='utf-8')
urls=re.findall(r'!\[[^\]]*\]\((https://raw\.githubusercontent\.com/Et1enneee/comp3500-logistics/main/[^)]+)\)',s)
with open(sys.argv[1],'w',encoding='utf-8') as out:
    for url in urls:
        path=url.split('/main/',1)[1]
        root=ET.parse(path).getroot()
        for text in root.iter('{http://www.w3.org/2000/svg}text'):
            out.write(' '.join(text.itertext())+'\n')
PY
body=$(wc -w < "$tmp/body" | tr -d ' ')
figures=$(wc -w < "$tmp/figures" | tr -d ' ')
total=$(cat "$tmp/body" "$tmp/figures" | wc -w | tr -d ' ')
printf 'Command: docs/submission/wordcount.sh (pandoc --to=plain | sed | wc -w; SVG text | wc -w)\n'
printf 'Pandoc body, excluding first URL line: %s\n' "$body"
printf 'SVG figure labels added: %s\n' "$figures"
printf 'Conservative total (includes image alt text and figure labels): %s\n' "$total"
printf 'Limit: 1000\n'
[ "$total" -le 1000 ] && echo 'Result: PASS' || { echo 'Result: FAIL'; exit 1; }
