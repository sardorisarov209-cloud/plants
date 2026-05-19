const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

require("dotenv").config();
const { Telegraf } = require("telegraf");

const { searchItunes } = require("./musicSearch");
const { transcribeVoice } = require("./stt");
const { sendVideoFromUrl } = require("./videoSender");

function envInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function replyWithMusicResults(ctx, query) {
  const maxResults = envInt("MAX_RESULTS", 5);
  const results = await searchItunes(query, maxResults);
  if (!results.length) {
    await ctx.reply("Hech narsa topilmadi. Boshqa so‘z bilan urinib ko‘ring.");
    return;
  }

  const lines = [`Natijalar: <code>${escapeHtml(query)}</code>\n`];
  for (const r of results) {
    const title = [r.artistName, r.trackName].filter(Boolean).join(" — ");
    const album = r.collectionName;
    const preview = r.previewUrl;
    const link = r.trackViewUrl || r.collectionViewUrl;

    const parts = [`• <b>${escapeHtml(title)}</b>`];
    if (album) parts.push(`  <i>${escapeHtml(album)}</i>`);
    if (preview) parts.push(`  Preview: ${preview}`);
    if (link) parts.push(`  Link: ${link}`);
    lines.push(parts.join("\n"));
  }

  await ctx.reply(lines.join("\n\n"), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN topilmadi. .env ni sozlang.");
  }

  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await ctx.reply(
      "Salom! Men musiqa qidiradigan botman.\n\n" +
        "Yordam: /help\n" +
        "Musiqa: matn yuboring yoki /music <so‘z>\n" +
        "Video: /video <direct_url>\n" +
        "Ovoz: ovozli xabar yuboring (STT yoqilgan bo‘lsa)."
    );
  });

  bot.command("help", async (ctx) => {
    const sttBackend = process.env.STT_BACKEND || "none";
    await ctx.reply(
      "<b>Buyruqlar</b>\n" +
        "- /music <qidiruv> — musiqa qidirish\n" +
        "- /video <direct_url> — direct video linkni qayta yuborish\n\n" +
        "<b>Ovozdan qidirish</b>\n" +
        `- STT_BACKEND: <code>${escapeHtml(sttBackend)}</code>\n` +
        "- Ovozli xabar yuboring: bot matnga aylantiradi va qidiradi.\n\n" +
        "<b>Eslatma</b>\n" +
        "- Bu bot faqat qonuniy manbalar/huquqli linklar bilan ishlash uchun mo‘ljallangan.",
      { parse_mode: "HTML" }
    );
  });

  bot.command("music", async (ctx) => {
    const text = ctx.message?.text || "";
    const query = text.split(/\s+/).slice(1).join(" ").trim();
    if (!query) {
      await ctx.reply("Foydalanish: /music <qidiruv matni>");
      return;
    }
    await replyWithMusicResults(ctx, query);
  });

  bot.command("video", async (ctx) => {
    const text = ctx.message?.text || "";
    const url = text.split(/\s+/).slice(1).join(" ").trim();
    if (!url) {
      await ctx.reply("Foydalanish: /video <direct_url>");
      return;
    }
    await sendVideoFromUrl(ctx, url);
  });

  bot.on("text", async (ctx) => {
    const text = (ctx.message?.text || "").trim();
    if (!text || text.startsWith("/")) return;
    await replyWithMusicResults(ctx, text);
  });

  bot.on("voice", async (ctx) => {
    const voice = ctx.message?.voice;
    if (!voice?.file_id) return;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-voice-"));
    try {
      const transcript = await transcribeVoice(ctx, voice.file_id, tmpDir);
      if (transcript == null) return;

      const t = transcript.trim();
      if (!t) {
        await ctx.reply("Ovozdan matn chiqarmadim. Qayta urinib ko‘ring.");
        return;
      }
      await ctx.reply(`Matn: <code>${escapeHtml(t)}</code>`, { parse_mode: "HTML" });
      await replyWithMusicResults(ctx, t);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  await bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

