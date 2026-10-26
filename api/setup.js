// Open https://<your-app>.vercel.app/api/setup once after deploying.
// It points Telegram at this deployment's /api/webhook and sets the bot's command menu.
const { TOKEN, call, webhookSecret } = require("../lib/telegram");

module.exports = async (req, res) => {
  if (!TOKEN) {
    res.status(500).send("BOT_TOKEN is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.");
    return;
  }
  const host = process.env.PUBLIC_URL
    ? process.env.PUBLIC_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : req.headers["x-forwarded-host"] || req.headers.host;
  const url = `https://${host}/api/webhook`;
  const set = await call("setWebhook", {
    url, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
  });
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "How to use the bot" },
      { command: "list", description: "Browse all care plan topics" },
      { command: "about", description: "About the book" },
    ],
  });
  const me = await call("getMe", {});
  const info = await call("getWebhookInfo", {});
  res.setHeader("content-type", "text/html; charset=utf-8");
  const ok = set.ok;
  res.status(ok ? 200 : 500).send(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;padding:24px;max-width:560px;margin:auto">
<h2>${ok ? "✅ Bot connected" : "❌ Setup failed"}</h2>
<p>Bot: <b>@${me.result ? me.result.username : "?"}</b></p>
<p>Webhook: <code>${url}</code></p>
<p>${ok ? "Open Telegram and send your bot a topic, e.g. <b>pneumonia</b>." : "Telegram said: " + (set.description || "unknown error")}</p>
<pre style="white-space:pre-wrap;background:#f3f3f3;padding:12px;border-radius:8px">${JSON.stringify(info.result || info, null, 2)}</pre>
</body>`);
};
