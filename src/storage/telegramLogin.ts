export type TelegramLoginData = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const KEY = "tg_login_v1";

function toStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function parse(input: any): TelegramLoginData | null {
  if (!input || typeof input !== "object") return null;
  const id = Number(input.id);
  const auth_date = Number(input.auth_date);
  const hash = toStr(input.hash);
  if (!Number.isFinite(id)) return null;
  if (!Number.isFinite(auth_date)) return null;
  if (!hash) return null;

  return {
    id,
    auth_date,
    hash,
    first_name: toStr(input.first_name),
    last_name: toStr(input.last_name),
    username: toStr(input.username),
    photo_url: toStr(input.photo_url)
  };
}

export function loadTelegramLogin(): TelegramLoginData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveTelegramLogin(data: TelegramLoginData | null) {
  if (!data) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(data));
}

