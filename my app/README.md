# Telegram bot (musiqa + ovozdan qidirish)

Bu loyiha Telegram bot yaratadi:
- Matn bo‘yicha musiqa qidiradi (iTunes Search API orqali) va natijalar/linklarni beradi.
- Ovozli xabarni matnga aylantirib (ixtiyoriy), shu matn bo‘yicha qidiradi.
- Video bo‘yicha: faqat **to‘g‘ridan-to‘g‘ri fayl URL** (sizda huquq bo‘lgan kontent) yuborilsa, bot uni Telegram orqali qayta yuborishga urinadi.

> Eslatma: YouTube/TikTok/Instagram kabi platformalardan “download” qilish (ayniqsa 4K) ko‘pincha ToS va mualliflik huquqlariga zid bo‘lishi mumkin. Bu repo faqat sizda ruxsat/hisob-kitob (license) bo‘lgan **to‘g‘ridan-to‘g‘ri** fayl linklari bilan ishlash uchun yozilgan.

## 1) Bot token olish
1. Telegram’da **@BotFather** ga kiring
2. `/newbot` -> nom bering -> token oling

## 2) Sozlash
1. `.env.example` ni `.env` ga ko‘chiring
2. `TELEGRAM_BOT_TOKEN` ni tokeningizga almashtiring
3. (ixtiyoriy) `STT_BACKEND=faster-whisper` qiling

## 3) O‘rnatish va ishga tushirish
```powershell
python -m pip install -r requirements.txt
python main.py
```

## Ovozli qidirish uchun talab
Ovozli xabarlar odatda `.ogg/.opus` bo‘ladi; uni `.wav` ga aylantirish uchun `ffmpeg` kerak.
- Windows: FFmpeg’ni o‘rnating va `ffmpeg` PATH’da ekanini tekshiring.

## Foydalanish
- `/start` yoki `/help`
- Matn yuboring: “eminem lose yourself”
- Ovozli xabar yuboring: bot matnga aylantirib qidiradi (STT yoqilgan bo‘lsa)
- `/video https://example.com/video.mp4` (faqat direct link)

