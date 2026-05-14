import { Markup, Telegraf } from "telegraf";
import { pathToFileURL } from "node:url";
import { readUserTasks, writeUserTasks } from "./storage.js";

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_not_set`);
  return value;
}

function getAppUrl() {
  return (process.env.APP_URL || "https://to-do-seven-rouge.vercel.app/").trim();
}

function appKeyboard(appUrl) {
  // Keyboard-button WebApp enables sendData -> web_app_data service messages
  return Markup.keyboard([[Markup.button.webApp("✅ Open ToDo", appUrl)]])
    .resize()
    .oneTime();
}

function helpText(appUrl) {
  const lines = [
    "ToDo Mini App bot.",
    "",
    "/start - menu",
    "/app - open Mini App",
    "/help - help",
    "",
    appUrl
      ? `Mini App URL: ${appUrl}`
      : "APP_URL yo'q. server/.env ichida APP_URL=... yozing (HTTPS)."
  ];
  return lines.join("\n");
}

export async function launchBot() {
  const token = mustEnv("BOT_TOKEN");
  const bot = new Telegraf(token);

  bot.catch((err, ctx) => {
    // eslint-disable-next-line no-console
    console.error("BOT_ERROR", err, { updateType: ctx.updateType });
  });
  // If a webhook was set earlier, long polling won't work until it's removed.
  await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});

  const me = await bot.telegram.getMe();
  // eslint-disable-next-line no-console
  console.log(`Bot: @${me.username ?? "unknown"}`);

  bot.start(async (ctx) => {
    const appUrl = getAppUrl();
    if (!appUrl) {
      await ctx.reply(helpText(""));
      return;
    }
    await ctx.reply(
      "Assalomu alaykum! Mini App'ni ochish uchun tugmani bosing:",
      appKeyboard(appUrl)
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(getAppUrl()));
  });

  bot.command("app", async (ctx) => {
    const appUrl = getAppUrl();
    if (!appUrl) {
      await ctx.reply("APP_URL yo'q. server/.env ichida APP_URL=... yozing (HTTPS).");
      return;
    }
    await ctx.reply("Mini App:", appKeyboard(appUrl));
  });

  bot.command("tasks", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User not found.");
      return;
    }
    const { tasks, meta } = await readUserTasks(userId);
    const done = tasks.filter((t) => t?.done).length;
    const total = tasks.length;
    const active = total - done;
    const updated = meta?.updatedAt ? new Date(meta.updatedAt).toLocaleString() : "never";
    await ctx.reply(`Tasks: ${active} active, ${done} done (total ${total})\nUpdated: ${updated}`);
  });

  bot.command("clear_done", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User not found.");
      return;
    }
    const { tasks } = await readUserTasks(userId);
    const before = tasks.length;
    const next = tasks.filter((t) => !t?.done);
    const removed = before - next.length;
    await writeUserTasks(userId, next);
    await ctx.reply(`Done tasks removed: ${removed}`);
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    await ctx.reply("Men ishlayapman ✅  /start yoki /app yozing.");
  });

  // Receive data from Telegram.WebApp.sendData
  bot.on("web_app_data", async (ctx) => {
    const raw =
      ctx?.webAppData?.data?.text?.() ?? ctx?.message?.web_app_data?.data ?? "";

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (parsed?.type === "export" && Array.isArray(parsed?.tasks)) {
      await ctx.reply(`Qabul qilindi ✅  Tasks: ${parsed.tasks.length}`);
      return;
    }

    await ctx.reply(`Data received ✅\n${raw ? raw.slice(0, 1000) : "(empty)"}`);
  });

  await bot.launch();
  // eslint-disable-next-line no-console
  console.log("Bot started (long polling)");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

function isMain() {
  const main = process.argv[1];
  if (!main) return false;
  return import.meta.url === pathToFileURL(main).href;
}

if (isMain()) {
  launchBot().catch((e) => {
    // eslint-disable-next-line no-console
    console.error("BOT_START_FAILED", e?.message ?? e);
    process.exitCode = 1;
  });
}
