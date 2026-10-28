"""Rebuild public/pdfs/ and data/plans.json from the final CPMN book PDF.

Every care plan in the book sits on exactly one page, so each plan page is
copied out as its own one-page PDF. Usage (from the repo root):

    pip install pymupdf
    python3 scripts/extract_from_book.py path/to/CPMN_book.pdf

Search names come from scripts/aliases.py; part titles are read from the
page headers of the book.
"""
import json, os, re, sys
import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from aliases import ALIASES

# Telegram caches files by URL: when the PDFs change, bump this folder
# (v2 -> v3) here AND PDF_DIR in api/webhook.js so users get the new copies.
OUT_DIR = os.path.join(ROOT, "public", "pdfs", "v2")
INDEX = os.path.join(ROOT, "data", "plans.json")
AUTHORS = "Jawad Waadallah Basheer; Ameer Ezat Hadi"
OLD_NOTE = "Full entries are listed in the References section."
NEW_NOTE = "Full entries are listed in the References section of the CPMN book."
FONT_CANDIDATES = ["/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf"]


def slugify(s):
    s = s.lower().replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def plan_pages(doc):
    """Yield (page_no, id, title, part_title) for every care-plan page."""
    H = doc[0].rect.height
    for i, page in enumerate(doc):
        blocks = [b for b in page.get_text("blocks") if 38 < b[1] < H - 42]
        if not blocks:
            continue
        blocks.sort(key=lambda b: (b[1], b[0]))
        first = blocks[0][4].strip().split("\n")[0]
        m = re.match(r"^(\d{1,2})\.(\d{1,2})\s+(.+?)\*?$", first)
        table_text = "".join(b[4] for b in blocks[:8])
        if not m or int(m.group(1)) < 2 or "Nursing Diagnosis" not in table_text:
            continue
        header = [b for b in page.get_text("blocks") if b[1] <= 38]
        part_title = ""
        for b in header:
            lines = [x.strip() for x in b[4].split("\n") if x.strip()]
            for x in lines:
                if "CarePlanMaster" not in x and x != "CPMN" and not x.startswith("CPMN"):
                    part_title = x.replace("\u2019", "'")
        yield i, f"{int(m.group(1))}.{int(m.group(2))}", m.group(3).strip().replace("\u2019", "'"), part_title


def main(book_pdf):
    src = fitz.open(book_pdf)
    plans = list(plan_pages(src))
    ids = [p[1] for p in plans]
    assert len(ids) == len(set(ids)), "a plan appears on more than one page"
    old = {p["id"]: p for p in json.load(open(INDEX, encoding="utf-8"))} if os.path.exists(INDEX) else {}
    font = next((f for f in FONT_CANDIDATES if os.path.exists(f)), None)

    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.endswith(".pdf"):
            os.remove(os.path.join(OUT_DIR, f))

    index = []
    for page_no, pid, title, part_title in plans:
        part = int(pid.split(".")[0])
        if not part_title and pid in old:
            part_title = old[pid]["part_title"]
        fname = f"{pid.replace('.', '-')}-{slugify(title)}.pdf"
        out = fitz.open()
        out.insert_pdf(src, from_page=page_no, to_page=page_no)
        pg = out[0]
        # the book's footnote points to "the References section"; make that
        # clear on a stand-alone page
        hits = pg.search_for(OLD_NOTE)
        if hits:
            r = hits[0]
            pg.add_redact_annot(r, fill=(1, 1, 1))
            pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            kw = dict(fontsize=7.5, color=(0x59 / 255,) * 3)
            if font:
                kw.update(fontname="carlito", fontfile=font)
            pg.insert_text((r.x0, r.y1 - 1.6), NEW_NOTE, **kw)
        out.subset_fonts()  # keep only the glyphs this page uses
        out.set_metadata({
            "title": f"{pid} {title} – CPMN Care Plan",
            "author": AUTHORS,
            "subject": "CPMN: CarePlanMaster for Nurses",
            "keywords": f"nursing care plan, {title}, NANDA-I",
            "creator": "CPMN care plan bot", "producer": "PyMuPDF",
        })
        out.save(os.path.join(OUT_DIR, fname), garbage=4, deflate=True, clean=True)
        index.append({"id": pid, "title": title, "part": part, "part_title": part_title,
                      "file": fname, "aliases": ALIASES.get(pid, [])})

    json.dump(index, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(index), "plans written")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
