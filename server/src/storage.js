import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, "..", "data");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function userFile(userId) {
  return path.join(dataDir, `${userId}.json`);
}

export async function readUserTasks(userId) {
  await ensureDataDir();
  const file = userFile(userId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    return { tasks, meta: { updatedAt: parsed?.updatedAt ?? null } };
  } catch {
    return { tasks: [], meta: { updatedAt: null } };
  }
}

export async function writeUserTasks(userId, tasks) {
  await ensureDataDir();
  const file = userFile(userId);
  const tmp = `${file}.tmp`;
  const payload = JSON.stringify(
    { v: 1, updatedAt: Date.now(), tasks: Array.isArray(tasks) ? tasks : [] },
    null,
    2
  );
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, file);
  return { ok: true };
}

