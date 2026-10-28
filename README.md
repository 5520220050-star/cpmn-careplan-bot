# CPMN Care Plan Bot

A Telegram bot for **CPMN: CarePlanMaster for Nurses** by Jawad Waadallah Basheer (College of Nursing, University of Mosul) and Ameer Ezat Hadi (College of Nursing, University of Kufa).
Send it a topic and it replies with that care plan page as a PDF.

- 284 care plans, one PDF page each (`public/pdfs/`), taken straight from the final book (NANDA-I 2024–2026 labels)
- Any letter case: `PNEUMONIA`, `Pneumonia`, `pneumonia`
- Misspellings: `pnemonia`, `hart failur`, `schizophernia`, `cesarian`
- Abbreviations: `MI`, `COPD`, `DKA`, `CVA`, `DVT`, `TKR`, `PPH` …
- British/American spelling: `anaemia` / `anemia`, `tumour` / `tumor`
- Plan numbers: `4.4`, `2-1`
- Arabic names: `السكري`, `الربو`, `ذات الرئة`, `الولادة القيصرية`
- Unclear queries get tap-to-choose buttons; `/list` browses every section

Runs as **serverless functions on Vercel**, deployed straight from this GitHub repo. No server, no Cloudflare, free tier is enough.

---

## Deploy from your phone (about 5 minutes)

### 1. Create the bot in Telegram
1. Open **@BotFather** in Telegram → send `/newbot`.
2. Choose a name and a username ending in `bot`.
3. Copy the **token** it gives you (looks like `123456789:AAH...`).

### 2. Deploy on Vercel
1. Open **vercel.com** in your phone browser → **Continue with GitHub**.
2. **Add New → Project** → pick this repository → **Import**.
3. Framework Preset: **Other**. Leave build settings empty.
4. Open **Environment Variables** and add
   - Name: `BOT_TOKEN`  Value: *your token from BotFather*
5. Tap **Deploy** and wait for it to finish.

### 3. Connect Telegram (once)
Open this address in your browser (use your own Vercel domain):

```
https://YOUR-PROJECT.vercel.app/api/setup
```

You should see **✅ Bot connected**. Now send your bot `pneumonia` in Telegram.

> If you add or change `BOT_TOKEN` later, redeploy (Deployments → ⋯ → Redeploy) and open `/api/setup` again.

---

## How it works

| Path | What it does |
|---|---|
| `api/webhook.js` | Receives Telegram messages, searches, sends the PDF |
| `api/setup.js` | Registers the webhook and the bot's command menu |
| `lib/search.js` | Case-insensitive, typo-tolerant search with abbreviations and Arabic |
| `data/plans.json` | Topic index (id, title, part, PDF file, extra search names) |
| `public/pdfs/` | One PDF per care plan, served as static files |
| `scripts/` | `extract_from_book.py` cuts the final book PDF into one PDF per care plan and rewrites `data/plans.json` |

To add search names for a topic, edit `aliases` in `data/plans.json` (or `scripts/aliases.py` and rerun `scripts/build.sh`), commit, and Vercel redeploys automatically.

When the book changes, export it to PDF and run `scripts/build.sh path/to/CPMN_book.pdf` (needs `pip install pymupdf`). It replaces `public/pdfs/` and updates `data/plans.json`, keeping the search names from `scripts/aliases.py`.

Run the tests with `npm test`.

## Commands
- `/start` – how to use
- `/list` – browse sections and topics
- `/about` – about the book

**Note:** the PDF links are public on your Vercel domain (Telegram needs to fetch them). Keep the GitHub repo private if you don't want the source shared.
