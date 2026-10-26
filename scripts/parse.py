import re, json, sys

src = open(sys.argv[1], encoding="utf-8").read().splitlines()

# Map part number -> part title
parts = {}
plans = []
cur_part_title = None
i = 0
for idx, line in enumerate(src):
    m = re.match(r"^\*\*PART (\d+)\*\*", line)
    if m:
        # next heading line "# Title"
        for j in range(idx + 1, idx + 5):
            if src[j].startswith("# "):
                parts[int(m.group(1))] = src[j][2:].strip()
                break

def clean(c):
    return c.strip()

for idx, line in enumerate(src):
    m = re.match(r"^## (\d+)\.(\d+)\s+(.+)$", line)
    if not m:
        continue
    p, n, title = int(m.group(1)), int(m.group(2)), m.group(3).strip()
    if p < 2:
        continue
    rows = []
    j = idx + 1
    while j < len(src) and not src[j].startswith("## ") and not src[j].startswith("**PART"):
        l = src[j]
        if l.startswith("| **Subjective**"):
            cells = [clean(c) for c in l.strip().strip("|").split(" | ")]
            if len(cells) != 5:
                print("BAD ROW", title, len(cells), file=sys.stderr)
            rows.append(cells)
        j += 1
    if len(rows) != 3:
        print("ROWS", title, len(rows), file=sys.stderr)
    plans.append({
        "id": f"{p}.{n}",
        "part": p,
        "part_title": parts.get(p, ""),
        "title": title,
        "rows": rows,
    })

json.dump(plans, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(plans), "plans;", len(parts), "parts")
