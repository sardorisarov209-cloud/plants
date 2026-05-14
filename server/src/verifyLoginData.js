import crypto from "node:crypto";

const ALLOWED_KEYS = new Set([
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date"
]);

function normalizeLoginData(input) {
  if (!input || typeof input !== "object") return null;

  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "hash") continue;
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }

  const hash = typeof input.hash === "string" ? input.hash : null;
  const authDate = out.auth_date ? Number(out.auth_date) : null;
  const id = out.id ? Number(out.id) : null;

  if (!hash) return null;
  if (!Number.isFinite(authDate)) return null;
  if (!Number.isFinite(id)) return null;

  return { raw: out, hash, authDate, id };
}

function buildCheckString(raw) {
  const pairs = Object.entries(raw)
    .filter(([k, _]) => k !== "hash")
    .sort((a, b) => a[0].localeCompare(b[0]));
  return pairs.map(([k, v]) => `${k}=${v}`).join("\n");
}

export function verifyLoginData(loginData, botToken, ttlSeconds) {
  if (!loginData) return { ok: false, reason: "missing_login_data" };
  if (!botToken) return { ok: false, reason: "missing_bot_token" };

  const normalized = normalizeLoginData(loginData);
  if (!normalized) return { ok: false, reason: "invalid_login_data" };

  const { raw, hash, authDate } = normalized;
  if (ttlSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    if (age < -60) return { ok: false, reason: "auth_date_in_future" };
    if (age > ttlSeconds) return { ok: false, reason: "login_expired" };
  }

  const checkString = buildCheckString(raw);
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  const ok =
    computed.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));

  return ok ? { ok: true, userId: String(normalized.id) } : { ok: false, reason: "hash_mismatch" };
}

