// Telegram webhook — Vercel serverless function (Node.js).
const { resolve, PLANS } = require("../lib/search");
const { TOKEN, call, sendPdf, webhookSecret } = require("../lib/telegram");

const PARTS = [];
for (const p of PLANS) {
  if (!PARTS.find((x) => x.part === p.part)) PARTS.push({ part: p.part, title: p.part_title });
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const byId = (id) => PLANS.find((p) => p.id === id);

// Telegram caches a file by its URL, so a new set of PDFs must live under a
// new folder (v2, v3, ...) or users keep getting the old cached copies.
const PDF_DIR = "pdfs/v2";
const btn = (p) => [{ text: `${p.id}  ${p.title}`, callback_data: `p:${p.id}` }];

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return `https://${host}`;
}

const WELCOME =
  "👋 <b>CPMN — CarePlanMaster for Nurses</b>\n\n" +
  "Send me a topic and I'll send you its nursing care plan page as a PDF.\n\n" +
  "Examples:\n• <code>pneumonia</code>\n• <code>MI</code> or <code>heart attack</code>\n" +
  "• <code>DKA</code>\n• <code>4.5</code> (plan number)\n• <code>السكري</code>\n\n" +
  "Capital or small letters and small spelling mistakes are fine.\n" +
  "Browse every topic with /list.";

async function sendPlan(chatId, plan, req, related = []) {
  await call("sendChatAction", { chat_id: chatId, action: "upload_document" });
  const url = `${baseUrl(req)}/${PDF_DIR}/${plan.file}`;
  const caption = `📄 <b>${esc(plan.id)}  ${esc(plan.title)}</b>\nPart ${plan.part} · ${esc(plan.part_title)}`;
  const markup = related.length
    ? { inline_keyboard: [[{ text: "Related care plans:", callback_data: "noop" }], ...related.map(btn)] }
    : undefined;
  return sendPdf(chatId, url, plan.file, caption, markup);
}

async function listParts(chatId, messageId) {
  const kb = PARTS.map((p) => [{ text: `Part ${p.part} · ${p.title}`, callback_data: `part:${p.part}` }]);
  const payload = { chat_id: chatId, text: "📚 <b>Choose a section:</b>", parse_mode: "HTML", reply_markup: { inline_keyboard: kb } };
  if (messageId) return call("editMessageText", { ...payload, message_id: messageId });
  return call("sendMessage", payload);
}

async function listPart(chatId, messageId, part) {
  const plans = PLANS.filter((p) => p.part === part);
  const info = PARTS.find((p) => p.part === part);
  const kb = plans.map(btn);
  kb.push([{ text: "⬅️ Back to sections", callback_data: "parts" }]);
  return call("editMessageText", {
    chat_id: chatId, message_id: messageId, parse_mode: "HTML",
    text: `<b>Part ${part} · ${esc(info ? info.title : "")}</b>\nTap a topic to get its PDF:`,
    reply_markup: { inline_keyboard: kb },
  });
}

async function onText(msg, req) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text) return;
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  if (cmd === "/start" || cmd === "/help") {
    return call("sendMessage", { chat_id: chatId, text: WELCOME, parse_mode: "HTML" });
  }
  if (cmd === "/list" || cmd === "/topics") return listParts(chatId);
  if (cmd === "/about") {
    return call("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: "<b>CPMN: CarePlanMaster for Nurses</b>\n\nJawad Waadallah Basheer\nCollege of Nursing, University of Mosul\n\nAmeer Ezat Hadi\nCollege of Nursing, University of Kufa\n\n" +
        `${PLANS.length} care plans, NANDA-I 2024–2026 terminology. Plans describe the typical patient; adapt them to your patient, the physician's orders and hospital policy.`,
    });
  }
  const query = text.startsWith("/") ? text.slice(1).replace(/_/g, " ") : text;
  const r = resolve(query);
  if (r.type === "send") return sendPlan(chatId, r.plan, req, r.related);
  if (r.type === "choose") {
    return call("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `🔎 Did you mean one of these for “${esc(text)}”?`,
      reply_markup: { inline_keyboard: r.options.map(btn) },
    });
  }
  return call("sendMessage", {
    chat_id: chatId, parse_mode: "HTML",
    text: `😕 I couldn't find a care plan for “${esc(text)}”.\n\nTry another name or an abbreviation (e.g. MI, COPD, DKA), or browse all topics with /list.`,
  });
}

async function onCallback(cq, req) {
  const data = cq.data || "";
  const chatId = cq.message && cq.message.chat.id;
  const msgId = cq.message && cq.message.message_id;
  await call("answerCallbackQuery", { callback_query_id: cq.id });
  if (!chatId) return;
  if (data.startsWith("p:")) {
    const plan = byId(data.slice(2));
    if (plan) return sendPlan(chatId, plan, req);
  } else if (data === "parts") {
    return listParts(chatId, msgId);
  } else if (data.startsWith("part:")) {
    return listPart(chatId, msgId, Number(data.slice(5)));
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("CPMN care plan bot webhook is running. Open /api/setup once to connect Telegram.");
    return;
  }
  if (!TOKEN) { res.status(500).send("BOT_TOKEN is not set"); return; }
  if (req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret()) {
    res.status(401).send("unauthorized"); return;
  }
  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (update.message) await onText(update.message, req);
    else if (update.callback_query) await onCallback(update.callback_query, req);
  } catch (e) {
    console.error(e);
  }
  res.status(200).json({ ok: true });
};
