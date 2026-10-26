// Simulates Telegram updates against the webhook with a fake Telegram API.
process.env.BOT_TOKEN = "123:TEST";
const sent = [];
global.fetch = async (url, opts) => {
  const body = opts && typeof opts.body === "string" ? JSON.parse(opts.body) : {};
  sent.push({ method: String(url).split("/").pop(), body });
  return { ok: true, json: async () => ({ ok: true, result: { username: "test_bot" } }) };
};
const handler = require("../api/webhook");
const { webhookSecret } = require("../lib/telegram");
function mockRes() { const r = { code: 0, status(c) { r.code = c; return r; }, send() { return r; }, json() { return r; } }; return r; }
async function hit(update) {
  sent.length = 0;
  const res = mockRes();
  await handler({ method: "POST", headers: { host: "bot.example.com", "x-telegram-bot-api-secret-token": webhookSecret() }, body: update }, res);
  return { code: res.code, calls: sent.map((s) => s.method + " " + (s.body.document || s.body.text || "").toString().slice(0, 70)) };
}
(async () => {
  const msg = (t) => ({ message: { chat: { id: 1 }, text: t } });
  for (const t of ["/start", "Pneumonia", "burns", "qwertyuiop", "/list"]) console.log(t, JSON.stringify(await hit(msg(t)), null, 0));
  console.log("cb", JSON.stringify(await hit({ callback_query: { id: "x", data: "p:4.4", message: { chat: { id: 1 }, message_id: 5 } } })));
  console.log("cb part", JSON.stringify(await hit({ callback_query: { id: "x", data: "part:3", message: { chat: { id: 1 }, message_id: 5 } } })));
  const bad = mockRes();
  await handler({ method: "POST", headers: {}, body: {} }, bad);
  console.log("no secret ->", bad.code);
})();
