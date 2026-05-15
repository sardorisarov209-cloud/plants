import { Markup, Telegraf } from "telegraf";
import { pathToFileURL } from "node:url";
import { readUserTasks, writeUserTasks } from "./storage.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

async function getAllUserIds() {
  try {
    const files = await fs.readdir(dataDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

async function checkAndSendReminders(bot) {
  const now = Date.now();
  const userIds = await getAllUserIds();

  for (const userId of userIds) {
    try {
      const { tasks } = await readUserTasks(userId);
      let updated = false;

      for (const task of tasks) {
        if (
          task.remindAt &&
          task.remindAt <= now &&
          !task.remindedAt &&
          !task.done
        ) {
          const message = `🔔 Eslatma: *${task.title}*\n\nVaqti: ${new Date(task.remindAt).toLocaleString("uz-UZ")}`;
          try {
            await bot.telegram.sendMessage(userId, message, {
              parse_mode: "Markdown"
            });
            task.remindedAt = now;
            updated = true;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Failed to send reminder to ${userId}:`, err.message);
          }
        }
      }

      if (updated) {
        await writeUserTasks(userId, tasks);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error checking reminders for user ${userId}:`, err.message);
    }
  }
}

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
    "/tasks - tasks soni",
    "/reminders - eslatmalar",
    "/clear_done - done tasklarni o'chirish",
    "/help - help",
    "",
    appUrl
      ? `Mini App URL: ${appUrl}`
      : "APP_URL yo'q. server/.env ichida APP_URL=... yozing (HTTPS)."
  ];
  return lines.join("\n");
}

export async function launchBot() {
  const token = ("8952901094:AAHzuj4S8e7c3JLS1FWCEMSM63eP11rp_Tg");
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
    
    const photoUrl = "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500&h=500&fit=crop";
    
    try {
      await ctx.replyWithPhoto(photoUrl, {
        caption: "Assalomu alaykum! 👋 Mini App'ni ochish uchun tugmani bosing:",
        reply_markup: appKeyboard(appUrl).reply_markup
      });
    } catch {
      // Agar rasm yuklanmasa, oddiy xabar yuborish
      await ctx.reply(
        "Assalomu alaykum! Mini App'ni ochish uchun tugmani bosing:",
        appKeyboard(appUrl)
      );
    }
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
    
    const photoUrl = "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop";
    
    try {
      await ctx.replyWithPhoto(photoUrl, {
        caption: "📱 Mini App:",
        reply_markup: appKeyboard(appUrl).reply_markup
      });
    } catch {
      await ctx.reply("Mini App:", appKeyboard(appUrl));
    }
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
    const updated = meta?.updatedAt ? new Date(meta.updatedAt).toLocaleString("uz-UZ") : "hech qachon";
    
    const message = [
      "✨ *TASK STATISTIKA* ✨",
      "",
      `📊 Jami tasklar: ${total}`,
      `🟢 Aktiv: ${active}`,
      `✅ Bajarilgan: ${done}`,
      "",
      `⏱️ Oxirgi o'zgarish: ${updated}`,
      "",
      "_Mini App'da yangi task qo'shish uchun /app bosing_"
    ].join("\n");
    
    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("reminders", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User not found.");
      return;
    }
    const { tasks } = await readUserTasks(userId);
    const reminders = tasks.filter((t) => t?.remindAt && !t?.done);

    if (reminders.length === 0) {
      await ctx.reply("✨ Hech qanday eslatma yo'q. Mini App'da o'rnatib ko'ring! ✨");
      return;
    }

    const sortedReminders = reminders.sort((a, b) => (a.remindAt ?? 0) - (b.remindAt ?? 0));
    const lines = sortedReminders.map((t) => {
      const remindDate = new Date(t.remindAt).toLocaleString("uz-UZ");
      const status = t.remindedAt ? "✅" : "⏰";
      const icon = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢";
      return `${status} ${icon} *${t.title}*\n   📅 \`${remindDate}\``;
    });
    
    const message = [
      "🔔 *ESLATMALAR* 🔔",
      "",
      ...lines,
      "",
      `_Jami: ${reminders.length} eslatma_`
    ].join("\n\n");

    await ctx.reply(message, { parse_mode: "Markdown" });
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

  // Start reminder checker - check every 30 seconds
  const reminderInterval = setInterval(async () => {
    await checkAndSendReminders(bot);
  }, 30000);

  process.once("SIGINT", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGTERM");
  });
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
