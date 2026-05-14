import type { Task } from "../types";
import type { TelegramLoginData } from "../storage/telegramLogin";

export type SyncAuth =
  | { type: "initData"; initData: string }
  | { type: "login"; loginData: TelegramLoginData };

function buildUrl(apiBaseUrl: string, path: string) {
  const base = apiBaseUrl.trim();
  if (!base) return path;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${b}${path}`;
}

async function readJsonOrThrow(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.error || json?.reason || res.statusText || "request_failed";
    throw new Error(`${res.status} ${msg}`);
  }
  return json;
}

function authHeaders(auth: SyncAuth): Record<string, string> {
  if (auth.type === "initData") return { "X-TG-Init-Data": auth.initData };
  return { "X-TG-Login": JSON.stringify(auth.loginData) };
}

export async function fetchTasksFromServer(auth: SyncAuth, apiBaseUrl: string) {
  const url = buildUrl(apiBaseUrl, "/api/tasks");
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(auth)
  });
  const json = await readJsonOrThrow(res);
  const tasks = Array.isArray(json?.tasks) ? (json.tasks as Task[]) : [];
  return tasks;
}

export async function pushTasksToServer(
  auth: SyncAuth,
  apiBaseUrl: string,
  tasks: Task[]
) {
  const url = buildUrl(apiBaseUrl, "/api/tasks");
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(auth)
    },
    body: JSON.stringify({ tasks })
  });
  await readJsonOrThrow(res);
}
