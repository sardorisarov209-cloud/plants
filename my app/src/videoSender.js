const URL_RE = /^https?:\/\//i;

async function sendVideoFromUrl(ctx, url) {
  const u = String(url || "").trim();
  if (!URL_RE.test(u)) {
    await ctx.reply("URL xato. Faqat http(s) direct link yuboring.");
    return;
  }

  try {
    await ctx.replyWithDocument(u, { caption: "Video (direct link)" });
  } catch {
    await ctx.reply(
      "Video yuborib bo‘lmadi. Ehtimol link direct emas yoki fayl juda katta.\n" +
        "Direct .mp4/.mkv link va kichikroq fayl bilan urinib ko‘ring."
    );
  }
}

module.exports = { sendVideoFromUrl };

