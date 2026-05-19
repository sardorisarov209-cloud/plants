import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import Message
from dotenv import load_dotenv

from music_search import search_itunes
from stt import transcribe_voice_message
from video_sender import send_video_from_url


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


async def cmd_start(message: Message) -> None:
    await message.answer(
        "Salom! Men musiqa qidiradigan botman.\n\n"
        "Yordam: /help\n"
        "Musiqa: matn yuboring yoki /music <so‘z>\n"
        "Video: /video <direct_url>\n"
        "Ovoz: ovozli xabar yuboring (STT yoqilgan bo‘lsa)."
    )


async def cmd_help(message: Message) -> None:
    stt_backend = os.getenv("STT_BACKEND", "none")
    await message.answer(
        "<b>Buyruqlar</b>\n"
        "- /music <qidiruv> — musiqa qidirish\n"
        "- /video <direct_url> — direct video linkni qayta yuborish\n\n"
        "<b>Ovozdan qidirish</b>\n"
        f"- STT_BACKEND: <code>{stt_backend}</code>\n"
        "- Ovozli xabar yuboring: bot matnga aylantiradi va qidiradi.\n\n"
        "<b>Eslatma</b>\n"
        "- Bu bot faqat qonuniy manbalar/huquqli linklar bilan ishlash uchun mo‘ljallangan."
    )


async def cmd_music(message: Message) -> None:
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await message.answer("Foydalanish: /music <qidiruv matni>")
        return
    await _reply_with_music_results(message, parts[1].strip())


async def _reply_with_music_results(message: Message, query: str) -> None:
    max_results = _env_int("MAX_RESULTS", 5)
    results = await search_itunes(query, limit=max_results)
    if not results:
        await message.answer("Hech narsa topilmadi. Boshqa so‘z bilan urinib ko‘ring.")
        return

    lines: list[str] = [f"<b>Natijalar:</b> <code>{query}</code>\n"]
    for r in results:
        title = f"{r.get('artistName', '')} — {r.get('trackName', '')}".strip(" —")
        album = r.get("collectionName")
        preview = r.get("previewUrl")
        track_view = r.get("trackViewUrl") or r.get("collectionViewUrl")

        parts = [f"• <b>{title}</b>"]
        if album:
            parts.append(f"  <i>{album}</i>")
        if preview:
            parts.append(f"  Preview: {preview}")
        if track_view:
            parts.append(f"  Link: {track_view}")
        lines.append("\n".join(parts))

    await message.answer("\n\n".join(lines), disable_web_page_preview=True)


async def on_text(message: Message) -> None:
    text = (message.text or "").strip()
    if not text or text.startswith("/"):
        return
    await _reply_with_music_results(message, text)


async def on_voice(message: Message, bot: Bot) -> None:
    transcript = await transcribe_voice_message(message, bot)
    if transcript is None:
        return
    transcript = transcript.strip()
    if not transcript:
        await message.answer("Ovozdan matn chiqarmadim. Qayta urinib ko‘ring.")
        return
    await message.answer(f"Matn: <code>{transcript}</code>")
    await _reply_with_music_results(message, transcript)


async def cmd_video(message: Message, bot: Bot) -> None:
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Foydalanish: /video <direct_url>")
        return
    url = parts[1].strip()
    await send_video_from_url(message, bot, url)


async def main() -> None:
    load_dotenv()
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN topilmadi. .env ni sozlang.")

    logging.basicConfig(level=logging.INFO)

    bot = Bot(
        token=token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    async def cmd_video_handler(message: Message) -> None:
        await cmd_video(message, bot)

    async def voice_handler(message: Message) -> None:
        await on_voice(message, bot)

    dp.message.register(cmd_start, Command("start"))
    dp.message.register(cmd_help, Command("help"))
    dp.message.register(cmd_music, Command("music"))
    dp.message.register(cmd_video_handler, Command("video"))
    dp.message.register(voice_handler, lambda m: m.voice is not None)
    dp.message.register(on_text, lambda m: m.text is not None)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
