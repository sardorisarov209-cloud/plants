from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import Optional

from aiogram import Bot
from aiogram.types import Message


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


async def transcribe_voice_message(message: Message, bot: Bot) -> Optional[str]:
    """
    Telegram voice message (.ogg/.opus) -> matn.
    STT_BACKEND:
      - none: o‘chirib qo‘yilgan
      - faster-whisper: lokal Whisper (faster-whisper) orqali
    """
    backend = (os.getenv("STT_BACKEND") or "none").strip().lower()
    if backend in {"", "none", "off", "false", "0"}:
        await message.answer(
            "Ovozdan qidirish hozir o‘chiq.\n"
            "Agar xohlasangiz `.env` da `STT_BACKEND=faster-whisper` qiling."
        )
        return None

    if backend != "faster-whisper":
        await message.answer(f"STT_BACKEND noto‘g‘ri: <code>{backend}</code>")
        return None

    if not message.voice:
        return None

    if not _ffmpeg_available():
        await message.answer(
            "Ovozli xabarni o‘qish uchun `ffmpeg` kerak (PATH’da bo‘lsin).\n"
            "FFmpeg o‘rnatilgandan keyin qayta urinib ko‘ring."
        )
        return None

    file = await bot.get_file(message.voice.file_id)
    voice_bytes = await bot.download_file(file.file_path)

    with tempfile.TemporaryDirectory() as td:
        ogg_path = os.path.join(td, "voice.ogg")
        wav_path = os.path.join(td, "voice.wav")
        with open(ogg_path, "wb") as f:
            f.write(voice_bytes.read())

        # 16kHz mono wav
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", ogg_path, "-ac", "1", "-ar", "16000", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if proc.returncode != 0 or not os.path.exists(wav_path):
            await message.answer("Ovozni konvertatsiya qila olmadim (ffmpeg xatosi).")
            return None

        try:
            from faster_whisper import WhisperModel
        except Exception:
            await message.answer(
                "`faster-whisper` o‘rnatilmagan yoki import bo‘lmadi.\n"
                "O‘rnatish: <code>python -m pip install -r requirements.txt</code>"
            )
            return None

        model_name = (os.getenv("WHISPER_MODEL") or "base").strip()
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segments, _info = model.transcribe(wav_path, beam_size=5, vad_filter=True)
        text = "".join(seg.text for seg in segments).strip()
        return text

