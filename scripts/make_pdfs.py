import json, re, os, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

FD = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", FD + "DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("DVB", FD + "DejaVuSansCondensed-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DVI", FD + "DejaVuSansCondensed-Oblique.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("DV", normal="DV", bold="DVB", italic="DVI", boldItalic="DVB")

INK = colors.HexColor("#1d2733")
MUTED = colors.HexColor("#5b6675")
ACCENT = colors.HexColor("#0f6e6e")      # teal
ACCENT_SOFT = colors.HexColor("#e6f2f1")
RISK = colors.HexColor("#b4561b")
RULE = colors.HexColor("#c9d3d9")
STRIPE = colors.HexColor("#f6f8f9")

CONNECTORS = set("""a an the of for to and or with in on by at from than as into
over under per via without within during while is are was be has have had his her their its
on all no any every both some off""".split())

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def split_items(text):
    """Split a run-together list of findings back into separate items."""
    toks = text.split(" ")
    items, cur, in_quote = [], [], False
    for t in toks:
        if cur and not in_quote:
            prev = cur[-1]
            starts = re.match(r"^([A-Z][a-z]|[A-Z]{2,}|[A-Z][a-z]*[₀-₉⁺])", t) or re.match(r"^\"", t) or re.match(r"^\*", t)
            prev_ok = not (len(cur) == 1 and prev.lower() in ("serum", "sputum", "smear-positive", "low", "high")) and not re.search(r"[,(:;/–\-]$", prev) and prev.lower().strip("\"") not in CONNECTORS
            if starts and prev_ok:
                items.append(" ".join(cur)); cur = []
        cur.append(t)
        if t.count('"') % 2 == 1:
            in_quote = not in_quote
    if cur:
        items.append(" ".join(cur))
    return items

def fmt_item(s):
    s = esc(s)
    s = re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)
    return s

def assessment(cell):
    m = re.match(r"\*\*Subjective\*\*\s*(.*?)\s*\*\*Objective\*\*\s*(.*)$", cell)
    subj, obj = m.group(1), m.group(2)
    out = [f'<font name="DVB" color="#0f6e6e">Subjective</font>']
    out += ["• " + fmt_item(x) for x in split_items(subj)]
    out += [f'<font name="DVB" color="#0f6e6e">Objective</font>']
    out += ["• " + fmt_item(x) for x in split_items(obj)]
    return out

def diagnosis(cell):
    m = re.match(r"\*\*(ACTUAL|RISK)\*\*\s*(.*)$", cell)
    kind, rest = m.group(1), m.group(2)
    col = "#0f6e6e" if kind == "ACTUAL" else "#b4561b"
    # bold the NANDA label (text before ' related to' / ' as evidenced')
    lab = re.split(r" related to | as evidenced by ", rest, maxsplit=1)
    label = lab[0]
    tail = rest[len(label):]
    return [f'<font name="DVB" color="{col}">{kind}</font>',
            f'<b>{esc(label)}</b>{esc(tail)}']

def sentences(cell):
    parts = re.split(r"(?<=[.?!])\s+(?=[A-Z\"(])", cell.strip())
    return parts

def bullets(cell):
    return ["• " + esc(x) for x in sentences(cell) if x]

def plain(cell):
    return [esc(cell)]

def evaluation(cell):
    s = esc(cell)
    s = re.sub(r"(goal met)", r"<b>\1</b>", s)
    return [s]

def cell_flow(lines, st):
    return [Paragraph(l, st) for l in lines]

def build(plan, path, slug_url=""):
    W, H = landscape(A4)
    M = 26
    c = canvas.Canvas(path, pagesize=(W, H))
    c.setTitle(f"{plan['id']} {plan['title']} – CPMN Care Plan")
    c.setAuthor("Jwad Waadallah Basheer")
    c.setSubject("CPMN: CarePlanMaster for Nurses")

    # header band
    c.setFillColor(ACCENT)
    c.rect(0, H - 6, W, 6, stroke=0, fill=1)
    c.setFillColor(MUTED); c.setFont("DVB", 8)
    c.drawString(M, H - 24, f"CPMN · CAREPLANMASTER FOR NURSES   |   PART {plan['part']} · {plan['part_title'].upper()}")
    c.setFillColor(INK); c.setFont("DVB", 19)
    c.drawString(M, H - 48, f"{plan['id']}  {plan['title']}")
    c.setStrokeColor(RULE); c.setLineWidth(0.6)
    c.line(M, H - 58, W - M, H - 58)

    top = H - 66
    bottom = 34
    avail_h = top - bottom
    widths_frac = [0.20, 0.175, 0.165, 0.29, 0.17]
    tw = W - 2 * M
    colw = [tw * f for f in widths_frac]

    headers = ["Assessment", "Nursing Diagnosis", "Plan / Expected Outcome", "Nursing Interventions", "Evaluation"]
    for fs in [9.8, 9.5, 9.2, 9.0, 8.8, 8.5, 8.2, 8.0, 7.8, 7.6, 7.4, 7.2, 7.0, 6.8, 6.6, 6.4, 6.2, 6.0]:
        body = ParagraphStyle("b", fontName="DV", fontSize=fs, leading=fs * 1.24, textColor=INK, spaceAfter=fs * 0.28)
        hst = ParagraphStyle("h", fontName="DVB", fontSize=fs + 0.6, leading=(fs + 0.6) * 1.2, textColor=colors.white)
        data = [[Paragraph(h, hst) for h in headers]]
        for r in plan["rows"]:
            data.append([
                cell_flow(assessment(r[0]), body),
                cell_flow(diagnosis(r[1]), body),
                cell_flow(plain(r[2]), body),
                cell_flow(bullets(r[3]), body),
                cell_flow(evaluation(r[4]), body),
            ])
        t = Table(data, colWidths=colw, repeatRows=0)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, RULE),
            ("LINEAFTER", (0, 1), (-2, -1), 0.4, RULE),
            ("BACKGROUND", (0, 2), (-1, 2), STRIPE),
        ]
        t.setStyle(TableStyle(style))
        w, h = t.wrap(tw, avail_h)
        if h <= avail_h:
            break
    t.drawOn(c, M, top - h)

    # footer
    c.setStrokeColor(RULE); c.line(M, 26, W - M, 26)
    c.setFont("DVI", 7); c.setFillColor(MUTED)
    c.drawString(M, 15, "Typical presentation only. Adapt diagnoses, outcomes and interventions to your patient, the physician's orders and hospital policy. Labels follow NANDA-I.")
    c.setFont("DV", 7)
    c.drawRightString(W - M, 15, "Jwad Waadallah Basheer · College of Nursing, University of Mosul")
    c.showPage(); c.save()
    return fs

def slugify(s):
    s = s.lower().replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

if __name__ == "__main__":
    plans = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    small = []
    only = sys.argv[3:] or None
    for p in plans:
        p["file"] = f"{p['id'].replace('.', '-')}-{slugify(p['title'])}.pdf"
        if only and p["id"] not in only:
            continue
        fs = build(p, os.path.join(out, p["file"]))
        if fs < 7.0:
            small.append((p["id"], fs))
    json.dump(plans, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("small fonts:", small)
