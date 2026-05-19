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

const MODE_BOT_TEXT = "Oddiy bot";
const MODE_APP_TEXT = "Mini App";
const ADD_TASK_TEXT = "Task qo'shish";
const TASKS_TEXT = "Tasklarim";
const REMINDERS_TEXT = "Eslatmalarim";
const CLEAR_DONE_TEXT = "Done tasklarni tozalash";
const HELP_TEXT = "Yordam";
const pendingActionByUserId = new Map();

function mainMenuKeyboard(appUrl) {
  const rows = [
    [MODE_BOT_TEXT, MODE_APP_TEXT],
    [ADD_TASK_TEXT, TASKS_TEXT, REMINDERS_TEXT],
    [CLEAR_DONE_TEXT, HELP_TEXT]
  ];
  if (appUrl) {
    rows.unshift([Markup.button.webApp("Open ToDo", appUrl)]);
  }
  return Markup.keyboard(rows).resize();
}

function modePickerInlineKeyboard(appUrl) {
  const buttons = [Markup.button.callback("Oddiy bot", "mode:bot")];
  if (appUrl) {
    buttons.push(Markup.button.callback("Mini App", "mode:app"));
  }
  return Markup.inlineKeyboard(buttons);
}

function botModeText() {
  return [
    "<b>Oddiy bot rejimi</b>",
    "",
    `${ADD_TASK_TEXT} - yangi task yaratish`,
    `${TASKS_TEXT} - task statistika`,
    `${REMINDERS_TEXT} - faol eslatmalar`,
    `${CLEAR_DONE_TEXT} - bajarilgan tasklarni tozalash`,
    `${HELP_TEXT} - barcha buyruqlar`
  ].join("\n");
}

async function sendMainMenu(ctx, text, extra = {}) {
  const appUrl = getAppUrl();
  await ctx.reply(text, {
    ...extra,
    reply_markup: mainMenuKeyboard(appUrl).reply_markup
  });
}

function createTaskFromTitle(title) {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    id: `bot_${now}_${rand}`,
    title,
    notes: "",
    tags: [],
    priority: "medium",
    dueAt: null,
    remindAt: null,
    remindedAt: null,
    pinned: false,
    done: false,
    createdAt: now,
    updatedAt: now,
    doneAt: null,
    subtasks: []
  };
}

async function replyAskTaskTitle(ctx) {
  const userId = String(ctx.from?.id ?? "");
  if (!userId) {
    await sendMainMenu(ctx, "User topilmadi.");
    return;
  }
  pendingActionByUserId.set(userId, "await_task_title");
  await sendMainMenu(
    ctx,
    "Yangi task nomini yuboring. Bekor qilish uchun `cancel` deb yozing."
  );
}

async function replyCreateTask(ctx, title) {
  const userId = String(ctx.from?.id ?? "");
  if (!userId) {
    await sendMainMenu(ctx, "User topilmadi.");
    return;
  }
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    await sendMainMenu(ctx, "Task nomi bo'sh bo'lmasligi kerak.");
    return;
  }
  const { tasks } = await readUserTasks(userId);
  const task = createTaskFromTitle(trimmed);
  await writeUserTasks(userId, [task, ...tasks]);
  await sendMainMenu(
    ctx,
    `Task qo'shildi: <b>${escapeHtml(trimmed)}</b>\nMini app ichida ham shu task ko'rinadi.`,
    { parse_mode: "HTML" }
  );
}

async function replyOpenMiniApp(ctx) {
  const appUrl = getAppUrl();
  if (!appUrl) {
    await sendMainMenu(ctx, "APP_URL topilmadi. server/.env ichida APP_URL=https://... kiriting.");
    return;
  }
  await sendMainMenu(ctx, "Mini appni ochish uchun pastdagi Open ToDo tugmasini bosing.");
}

async function replyTasksStats(ctx) {
  const userId = String(ctx.from?.id ?? "");
  if (!userId) {
    await sendMainMenu(ctx, "User topilmadi.");
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

  await sendMainMenu(ctx, message, { parse_mode: "HTML" });
}

async function replyReminders(ctx) {
  const userId = String(ctx.from?.id ?? "");
  if (!userId) {
    await sendMainMenu(ctx, "User topilmadi.");
    return;
  }

  const { tasks } = await readUserTasks(userId);
  const reminders = tasks
    .filter((task) => Number.isFinite(Number(task?.remindAt)) && !task?.done)
    .sort((a, b) => Number(a.remindAt) - Number(b.remindAt));

  if (reminders.length === 0) {
    await sendMainMenu(ctx, "Faol eslatma topilmadi. Mini app ichida reminder qoying.");
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
  await sendMainMenu(ctx, [header, "", ...lines].join("\n"), { parse_mode: "HTML" });
}

async function replyClearDone(ctx) {
  const userId = String(ctx.from?.id ?? "");
  if (!userId) {
    await sendMainMenu(ctx, "User topilmadi.");
    return;
  }
  const { tasks } = await readUserTasks(userId);
  const next = tasks.filter((task) => !task?.done);
  const removed = tasks.length - next.length;
  await writeUserTasks(userId, next);
  await sendMainMenu(ctx, `Bajarilgan tasklar ochirildi: ${removed}`);
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
  await bot.telegram
    .setMyCommands([
      { command: "start", description: "Menu va rejim tanlash" },
      { command: "add", description: "Yangi task qo'shish" },
      { command: "app", description: "Mini appni ochish" },
      { command: "tasks", description: "Task statistikasi" },
      { command: "reminders", description: "Faol eslatmalar" },
      { command: "clear_done", description: "Done tasklarni tozalash" },
      { command: "help", description: "Yordam" }
    ])
    .catch(() => {});

  bot.start(async (ctx) => {
    const appUrl = getAppUrl();
    await ctx.reply(
      "Salom. Qaysi rejimni ishlatamiz?",
      modePickerInlineKeyboard(appUrl)
    );
    await sendMainMenu(
      ctx,
      "Pastdagi tayyor tugmalar orqali oddiy bot komandalarini ishlatishingiz mumkin."
    );
  });

  bot.command("help", async (ctx) => {
    await sendMainMenu(ctx, helpText(getAppUrl()));
  });

  bot.command("app", async (ctx) => {
    await replyOpenMiniApp(ctx);
  });

  bot.command("add", async (ctx) => {
    await replyAskTaskTitle(ctx);
  });

  bot.command("tasks", async (ctx) => {
    await replyTasksStats(ctx);
  });

  bot.command("reminders", async (ctx) => {
    await replyReminders(ctx);
  });

  bot.command("clear_done", async (ctx) => {
    await replyClearDone(ctx);
  });

  bot.action("mode:bot", async (ctx) => {
    await ctx.answerCbQuery("Oddiy bot rejimi tanlandi");
    await sendMainMenu(ctx, botModeText(), { parse_mode: "HTML" });
  });

  bot.action("mode:app", async (ctx) => {
    const appUrl = getAppUrl();
    if (!appUrl) {
      await ctx.answerCbQuery("Mini app hali sozlanmagan");
      await sendMainMenu(ctx, "APP_URL topilmadi. server/.env ichida APP_URL=https://... kiriting.");
      return;
    }
    await ctx.answerCbQuery("Mini app rejimi tanlandi");
    await sendMainMenu(ctx, "Mini appni ochish uchun pastdagi Open ToDo tugmasini bosing.");
  });

  bot.on("text", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    const text = String(ctx.message.text ?? "").trim();
    if (text.startsWith("/")) return;
    const pending = userId ? pendingActionByUserId.get(userId) : undefined;

    if (pending === "await_task_title") {
      if (text.toLowerCase() === "cancel") {
        if (userId) pendingActionByUserId.delete(userId);
        await sendMainMenu(ctx, "Task qo'shish bekor qilindi.");
        return;
      }
      if (userId) pendingActionByUserId.delete(userId);
      await replyCreateTask(ctx, text);
      return;
    }

    if (text === MODE_BOT_TEXT) {
      await sendMainMenu(ctx, botModeText(), { parse_mode: "HTML" });
      return;
    }
    if (text === ADD_TASK_TEXT) {
      await replyAskTaskTitle(ctx);
      return;
    }
    if (text === MODE_APP_TEXT) {
      await replyOpenMiniApp(ctx);
      return;
    }
    if (text === TASKS_TEXT) {
      await replyTasksStats(ctx);
      return;
    }
    if (text === REMINDERS_TEXT) {
      await replyReminders(ctx);
      return;
    }
    if (text === CLEAR_DONE_TEXT) {
      await replyClearDone(ctx);
      return;
    }
    if (text === HELP_TEXT) {
      await sendMainMenu(ctx, helpText(getAppUrl()));
      return;
    }

    await sendMainMenu(ctx, "Tugmalardan birini tanlang yoki /start bosing.");
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
      await sendMainMenu(ctx, `Qabul qilindi. Tasklar soni: ${parsed.tasks.length}`);
      return;
    }
    await sendMainMenu(ctx, `Data qabul qilindi: ${raw ? raw.slice(0, 400) : "(empty)"}`);
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
