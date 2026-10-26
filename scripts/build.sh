#!/usr/bin/env bash
# Rebuild data/plans.json and public/pdfs/ from scripts/source/CPMN_Book.txt
# Needs: python3, pip install reportlab, DejaVu fonts.
set -e
cd "$(dirname "$0")"
python3 parse.py source/CPMN_Book.txt /tmp/plans.json
rm -rf ../public/pdfs && python3 make_pdfs.py /tmp/plans.json ../public/pdfs
python3 - <<'PY'
import json, sys
sys.path.insert(0, '.')
from aliases import ALIASES
p = json.load(open('/tmp/plans.json'))
idx = [{"id": x["id"], "title": x["title"], "part": x["part"], "part_title": x["part_title"],
        "file": x["file"], "aliases": ALIASES.get(x["id"], [])} for x in p]
json.dump(idx, open('../data/plans.json', 'w'), ensure_ascii=False, indent=1)
print(len(idx), "plans written")
PY
