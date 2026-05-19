from __future__ import annotations

import re

from aiogram import Bot
from aiogram.types import Message


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


async def send_video_from_url(message: Message, bot: Bot, url: str) -> None:
    """
    Qonuniy direct fayl URL bo‘lsa, Telegram orqali qayta yuboradi.
    Eslatma: katta (4K) fayllar Telegram limitlariga tushib qolishi mumkin.
    """
    u = (url or "").strip()
    if not _URL_RE.match(u):
        await message.answer("URL xato. Faqat http(s) direct link yuboring.")
        return

    # Telegram serveri URL'dan yuklab yuboradi (ishlashi fayl hajmi va URL ochiqligiga bog‘liq).
    try:
        await bot.send_document(chat_id=message.chat.id, document=u, caption="Video (direct link)")
    except Exception:
        await message.answer(
            "Video yuborib bo‘lmadi. Ehtimol link direct emas yoki fayl juda katta.\n"
            "Direct .mp4/.mkv link va kichikroq fayl bilan urinib ko‘ring."
        )

