# Telegram ToDo Mini App (React + Node)

## Muhim (Security)

Siz chatga bot token yuborgansiz. Bu token **kompromat** bo'lgan bo'lishi mumkin. BotFather orqali tokenni **almashtiring (revoke/rotate)** va yangi tokenni faqat `.env` ichida saqlang.

## 1) Frontend (React/Vite)

PowerShell'da `npm` ps1 blok bo'lsa, shuni ishlating:

```bat
cmd /c npm install
cmd /c npm run dev
```

Brauzer: `http://localhost:5173`

## 2) Backend (Node/Express)

```bat
cmd /c npm --prefix server install
copy server\\.env.example server\\.env
```

`server\\.env` ichida `BOT_TOKEN=` ni yangi token bilan to'ldiring.
Mini App URL uchun `APP_URL=` ni ham kiriting (HTTPS).

Server:

```bat
cmd /c npm --prefix server run dev
```

Health check: `http://localhost:4000/health`

## 2b) Telegram Bot (Telegraf)

Bot javob berishi uchun bot process ham ishlashi kerak:

```bat
cmd /c npm --prefix server run bot:dev
```

Eslatma: `APP_URL` HTTPS bo'lishi shart (oddiy `localhost` production token bilan ishlamaydi).

## 3) Telegram ichida ishga tushirish

1. Frontend'ni hostingga chiqarish: `cmd /c npm run build` → `dist/` ni HTTPS hostingga joylang.
2. BotFather'da Mini App URL sifatida shu HTTPS linkni qo'ying.
3. Telegram ichida ochilganda `initData` keladi va `Settings → Server Sync` ishlaydi.
