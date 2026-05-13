import type { PersistedStateV1, Settings, Task } from "../types";

const STORAGE_KEY = "tg_todo_miniapp_v1";

const DEFAULT_SETTINGS: Settings = {
  vibrate: true,
  autoSync: true,
  apiBaseUrl: ""
};

export function loadState(): PersistedStateV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, tasks: [], settings: DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as PersistedStateV1;
    if (parsed?.v !== 1) return { v: 1, tasks: [], settings: DEFAULT_SETTINGS };
    return {
      v: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    };
  } catch {
    return { v: 1, tasks: [], settings: DEFAULT_SETTINGS };
  }
}

export function saveState(tasks: Task[], settings: Settings) {
  const state: PersistedStateV1 = { v: 1, tasks, settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getDefaultSettings(): Settings {
  return DEFAULT_SETTINGS;
}

