import crypto from "node:crypto";

function getCheckString(initData) {
  const params = new URLSearchParams(initData);
  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash" || key === "signature") continue;
    pairs.push([key, value]);
  }
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  return pairs.map(([k, v]) => `${k}=${v}`).join("\n");
}

export function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const data = Object.fromEntries(params.entries());
  let user = null;
  try {
    user = data.user ? JSON.parse(data.user) : null;
  } catch {
    user = null;
  }
  const authDate = data.auth_date ? Number(data.auth_date) : null;
  const hash = data.hash ?? null;
  return { raw: data, user, authDate, hash };
}

export function verifyInitData(initData, botToken, ttlSeconds) {
  if (!initData) return { ok: false, reason: "missing_initData" };
  if (!botToken) return { ok: false, reason: "missing_bot_token" };

  const { authDate, hash } = parseInitData(initData);
  if (!hash) return { ok: false, reason: "missing_hash" };

  if (ttlSeconds && authDate) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    if (age < -60) return { ok: false, reason: "auth_date_in_future" };
    if (age > ttlSeconds) return { ok: false, reason: "initData_expired" };
  }

  const checkString = getCheckString(initData);
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  const ok =
    computed.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));

  return ok ? { ok: true } : { ok: false, reason: "hash_mismatch" };
}

