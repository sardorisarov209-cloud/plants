import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Markup, Telegraf } from "telegraf";
import { readUserTasks, writeUserTasks } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

function mustEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name}_not_set`);
  return value;
}

function getAppUrl() {
  return String(process.env.APP_URL ?? "").trim();
}

function getReminderCheckIntervalMs() {
  const raw = Number(process.env.REMINDER_CHECK_INTERVAL_MS ?? "30000");
  if (!Number.isFinite(raw)) return 30000;
  return Math.max(5000, raw);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("uz-UZ");
}

function toPriorityLabel(priority) {
  if (priority === "high") return "HIGH";
  if (priority === "low") return "LOW";
  return "MED";
}

async function getAllUserIds() {
  try {
    const files = await fs.readdir(dataDir);
    return files
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.replace(".json", ""))
      .filter((userId) => /^\d+$/.test(userId));
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
        const remindAt = Number(task?.remindAt ?? NaN);
        const remindedAt = Number(task?.remindedAt ?? NaN);
        const shouldSend =
          Number.isFinite(remindAt) &&
          remindAt > 0 &&
          remindAt <= now &&
          !Number.isFinite(remindedAt) &&
          !task?.done;

        if (!shouldSend) continue;

        const title = escapeHtml(task?.title || "Task");
        const when = escapeHtml(formatDateTime(remindAt));
        const message = [
          "<b>Eslatma vaqti keldi</b>",
          "",
          `<b>Task:</b> ${title}`,
          `<b>Vaqt:</b> ${when}`
        ].join("\n");

        try {
          await bot.telegram.sendMessage(userId, message, { parse_mode: "HTML" });
          task.remindedAt = now;
          updated = true;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`REMINDER_SEND_FAILED user=${userId}`, err?.message ?? err);
        }
      }

      if (updated) {
        await writeUserTasks(userId, tasks);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`REMINDER_CHECK_FAILED user=${userId}`, err?.message ?? err);
    }
  }
}

function appKeyboard(appUrl) {
  return Markup.keyboard([[Markup.button.webApp("Open ToDo", appUrl)]])
    .resize()
    .oneTime();
}

function helpText(appUrl) {
  const lines = [
    "ToDo Mini App bot",
    "",
    "/start - menu",
    "/app - open mini app",
    "/tasks - task statistikasi",
    "/reminders - faol eslatmalar",
    "/clear_done - bajarilgan tasklarni ochirish",
    "/help - yordam",
    "",
    appUrl
      ? `Mini App URL: ${appUrl}`
      : "APP_URL topilmadi. server/.env ichida APP_URL=https://... kiriting."
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

  await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});

  const me = await bot.telegram.getMe();
  // eslint-disable-next-line no-console
  console.log(`Bot connected as @${me.username ?? "unknown"}`);

  bot.start(async (ctx) => {
    const appUrl = getAppUrl();
    if (!appUrl) {
      await ctx.reply(helpText(""));
      return;
    }
    await ctx.reply(
      "Salom! Task eslatmalari ishlashi uchun shu botni bloklamang. Mini appni quyidagi tugma bilan oching.",
      appKeyboard(appUrl)
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(getAppUrl()));
  });

  bot.command("app", async (ctx) => {
    const appUrl = getAppUrl();
    if (!appUrl) {
      await ctx.reply("APP_URL topilmadi. server/.env ichida APP_URL=https://... kiriting.");
      return;
    }
    await ctx.reply("Mini appni ochish:", appKeyboard(appUrl));
  });

  bot.command("tasks", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User topilmadi.");
      return;
    }

    const { tasks, meta } = await readUserTasks(userId);
    const done = tasks.filter((task) => task?.done).length;
    const total = tasks.length;
    const active = total - done;
    const updated = meta?.updatedAt ? formatDateTime(meta.updatedAt) : "hali yoq";

    const message = [
      "<b>Task statistikasi</b>",
      "",
      `<b>Jami:</b> ${total}`,
      `<b>Aktiv:</b> ${active}`,
      `<b>Bajarilgan:</b> ${done}`,
      `<b>Oxirgi yangilanish:</b> ${escapeHtml(updated)}`
    ].join("\n");

    await ctx.reply(message, { parse_mode: "HTML" });
  });

  bot.command("reminders", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User topilmadi.");
      return;
    }

    const { tasks } = await readUserTasks(userId);
    const reminders = tasks
      .filter((task) => Number.isFinite(Number(task?.remindAt)) && !task?.done)
      .sort((a, b) => Number(a.remindAt) - Number(b.remindAt));

    if (reminders.length === 0) {
      await ctx.reply("Faol eslatma topilmadi. Mini app ichida reminder qoying.");
      return;
    }

    const lines = reminders.slice(0, 15).map((task) => {
      const title = escapeHtml(task?.title || "Task");
      const remindAt = formatDateTime(Number(task.remindAt));
      const status = Number.isFinite(Number(task?.remindedAt)) ? "sent" : "pending";
      const priority = toPriorityLabel(task?.priority);
      return `- <b>${title}</b>\n  ${escapeHtml(remindAt)} | ${status} | ${priority}`;
    });

    const header = `<b>Eslatmalar (${reminders.length})</b>`;
    await ctx.reply([header, "", ...lines].join("\n"), { parse_mode: "HTML" });
  });

  bot.command("clear_done", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!userId) {
      await ctx.reply("User topilmadi.");
      return;
    }
    const { tasks } = await readUserTasks(userId);
    const next = tasks.filter((task) => !task?.done);
    const removed = tasks.length - next.length;
    await writeUserTasks(userId, next);
    await ctx.reply(`Bajarilgan tasklar ochirildi: ${removed}`);
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    await ctx.reply("Buyruqlar uchun /help yozing.");
  });

  bot.on("web_app_data", async (ctx) => {
    const raw = ctx?.webAppData?.data?.text?.() ?? ctx?.message?.web_app_data?.data ?? "";

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (parsed?.type === "export" && Array.isArray(parsed?.tasks)) {
      await ctx.reply(`Qabul qilindi. Tasklar soni: ${parsed.tasks.length}`);
      return;
    }
    await ctx.reply(`Data qabul qilindi: ${raw ? raw.slice(0, 400) : "(empty)"}`);
  });

  await bot.launch();
  // eslint-disable-next-line no-console
  console.log("Bot started (long polling)");

  await checkAndSendReminders(bot);
  const reminderInterval = setInterval(() => {
    void checkAndSendReminders(bot);
  }, getReminderCheckIntervalMs());

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
  launchBot().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("BOT_START_FAILED", error?.message ?? error);
    process.exitCode = 1;
  });
}
