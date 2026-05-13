import { getWebApp } from "./getWebApp";

export function initTelegram() {
  const tg = getWebApp();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
  } catch {
    // ignore
  }

  try {
    tg.setHeaderColor?.("secondary_bg_color");
    tg.setBackgroundColor?.("bg_color");
  } catch {
    // ignore
  }
}

