export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

