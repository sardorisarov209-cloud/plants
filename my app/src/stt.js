const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function ffmpegAvailable() {
  try {
    const r = childProcess.spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

async function downloadTelegramFile(ctx, fileId, outPath) {
  const url = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(url.href);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function convertToWav(inPath, outPath) {
  const r = childProcess.spawnSync(
    "ffmpeg",
    ["-y", "-i", inPath, "-ac", "1", "-ar", "16000", outPath],
    { stdio: "ignore" }
  );
  return r.status === 0 && fs.existsSync(outPath);
}

async function transcribeViaOpenAI(wavPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Minimal HTTP call. If you want, we can swap to the official OpenAI Node SDK.
  const form = new FormData();
  form.append("model", process.env.OPENAI_STT_MODEL || "whisper-1");
  form.append("file", new Blob([fs.readFileSync(wavPath)]), path.basename(wavPath));

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.text === "string" ? data.text : null;
}

async function transcribeVoice(ctx, fileId, tmpDir) {
  const backend = String(process.env.STT_BACKEND || "none").trim().toLowerCase();
  if (!backend || backend === "none" || backend === "off" || backend === "false" || backend === "0") {
    await ctx.reply(
      "Ovozdan qidirish hozir o‘chiq.\n" +
        "Agar xohlasangiz `.env` da `STT_BACKEND=openai` qiling (va `OPENAI_API_KEY` qo‘ying)."
    );
    return null;
  }

  if (backend !== "openai") {
    await ctx.reply(`STT_BACKEND noto‘g‘ri: <code>${backend}</code>`, { parse_mode: "HTML" });
    return null;
  }

  const oggPath = path.join(tmpDir, "voice.ogg");
  const wavPath = path.join(tmpDir, "voice.wav");

  await downloadTelegramFile(ctx, fileId, oggPath);

  if (ffmpegAvailable()) {
    const ok = convertToWav(oggPath, wavPath);
    if (!ok) {
      await ctx.reply("Ovozni konvertatsiya qila olmadim (ffmpeg xatosi).");
      return null;
    }
  } else {
    // OpenAI odatda ko‘p formatlarni qabul qiladi, lekin konvert bo‘lmasa baribir urinamiz.
    fs.copyFileSync(oggPath, wavPath);
  }

  const text = await transcribeViaOpenAI(wavPath);
  if (text == null) {
    await ctx.reply(
      "Ovozdan matn olish ishlamadi.\n" +
        "Tekshiring: `OPENAI_API_KEY` to‘g‘ri va hisobingizda balans bor.\n" +
        "Agar xohlasangiz, lokal (offline) STT variantini ham qo‘shib beraman."
    );
    return null;
  }
  return text;
}

module.exports = { transcribeVoice };

