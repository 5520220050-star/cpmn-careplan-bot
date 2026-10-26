const crypto = require("crypto");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const API = `https://api.telegram.org/bot${TOKEN}`;

// Secret Telegram sends back in every webhook call, derived from the token
// so no extra setting is needed.
function webhookSecret() {
  return crypto.createHash("sha256").update("cpmn:" + TOKEN).digest("hex").slice(0, 48);
}

async function call(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({ ok: false, description: "bad json" }));
  if (!data.ok) console.error(`Telegram ${method} failed:`, data.description);
  return data;
}

// Send a PDF. First try by URL (fast); if Telegram can't fetch it,
// download it ourselves and upload the bytes.
async function sendPdf(chatId, url, filename, caption, replyMarkup) {
  const r = await call("sendDocument", {
    chat_id: chatId, document: url, caption, parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
  if (r.ok) return r;
  try {
    const file = await fetch(url);
    if (!file.ok) throw new Error(`fetch ${file.status}`);
    const buf = Buffer.from(await file.arrayBuffer());
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
    form.append("document", new Blob([buf], { type: "application/pdf" }), filename);
    const res = await fetch(`${API}/sendDocument`, { method: "POST", body: form });
    return await res.json();
  } catch (e) {
    console.error("upload fallback failed:", e.message);
    return r;
  }
}

module.exports = { TOKEN, call, sendPdf, webhookSecret };
