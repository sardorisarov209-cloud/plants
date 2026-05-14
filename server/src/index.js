import cors from "cors";
import express from "express";
import { parseInitData, verifyInitData } from "./verifyInitData.js";
import { verifyLoginData } from "./verifyLoginData.js";
import { readUserTasks, writeUserTasks } from "./storage.js";

const app = express();
app.set("etag", false);

app.use((_, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true
  })
);

app.use(express.json({ limit: "500kb" }));

app.get("/health", (_, res) => {
  res.json({ ok: true, time: Date.now() });
});

function getInitData(req) {
  const fromHeader =
    req.get("x-tg-init-data") || req.get("x-telegram-init-data") || "";
  const fromBody = typeof req.body?.initData === "string" ? req.body.initData : "";
  return fromHeader || fromBody;
}

function getLoginData(req) {
  const fromHeader = req.get("x-tg-login") || "";
  const fromBody = req.body?.loginData && typeof req.body.loginData === "object" ? req.body.loginData : null;
  if (fromHeader) {
    try {
      return JSON.parse(fromHeader);
    } catch {
      return { __parse_error: true };
    }
  }
  return fromBody;
}

function auth(req, res, next) {
  const initData = getInitData(req);
  const loginData = getLoginData(req);
  const botToken = process.env.BOT_TOKEN || "";
  const ttlSeconds = Number(process.env.INITDATA_TTL_SECONDS || "86400");

  if (!botToken) {
    res.status(500).json({ ok: false, error: "BOT_TOKEN_not_set" });
    return;
  }

  // Prefer Mini App initData when available.
  if (initData) {
    const check = verifyInitData(initData, botToken, ttlSeconds);
    if (!check.ok) {
      res.status(401).json({ ok: false, error: "unauthorized", reason: check.reason });
      return;
    }

    const parsed = parseInitData(initData);
    const userId = parsed.user?.id;
    if (!userId) {
      res.status(401).json({ ok: false, error: "no_user_in_initData" });
      return;
    }

    req.tgUserId = String(userId);
    req.tgUser = parsed.user;
    next();
    return;
  }

  if (loginData?.__parse_error) {
    res.status(401).json({ ok: false, error: "unauthorized", reason: "invalid_login_json" });
    return;
  }

  if (loginData) {
    const check = verifyLoginData(loginData, botToken, ttlSeconds);
    if (!check.ok) {
      res.status(401).json({ ok: false, error: "unauthorized", reason: check.reason });
      return;
    }

    req.tgUserId = check.userId;
    req.tgUser = {
      id: Number(check.userId),
      first_name: loginData.first_name ?? "",
      last_name: loginData.last_name ?? "",
      username: loginData.username ?? "",
      photo_url: loginData.photo_url ?? ""
    };
    next();
    return;
  }

  res.status(401).json({ ok: false, error: "unauthorized", reason: "missing_auth" });
}

app.get("/api/me", auth, async (req, res) => {
  res.json({ ok: true, user: req.tgUser, userId: req.tgUserId, serverTime: Date.now() });
});

app.get("/api/tasks", auth, async (req, res) => {
  const { tasks, meta } = await readUserTasks(req.tgUserId);
  res.json({ ok: true, tasks, meta, serverTime: Date.now() });
});

app.put("/api/tasks", auth, async (req, res) => {
  const tasks = req.body?.tasks;
  await writeUserTasks(req.tgUserId, tasks);
  res.json({ ok: true, serverTime: Date.now() });
});

const port = Number(process.env.PORT || "4000");
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});
