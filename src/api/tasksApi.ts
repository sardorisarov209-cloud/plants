import type { Task } from "../types";

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

export async function fetchTasksFromServer(initData: string, apiBaseUrl: string) {
  const url = buildUrl(apiBaseUrl, "/api/tasks");
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-TG-Init-Data": initData
    }
  });
  const json = await readJsonOrThrow(res);
  const tasks = Array.isArray(json?.tasks) ? (json.tasks as Task[]) : [];
  return tasks;
}

export async function pushTasksToServer(
  initData: string,
  apiBaseUrl: string,
  tasks: Task[]
) {
  const url = buildUrl(apiBaseUrl, "/api/tasks");
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-TG-Init-Data": initData
    },
    body: JSON.stringify({ tasks })
  });
  await readJsonOrThrow(res);
}

