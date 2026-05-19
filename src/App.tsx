import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTasksFromServer, pushTasksToServer, type SyncAuth } from "./api/tasksApi";
import { Focus } from "./components/Focus";
import { IconPlus, IconSpark } from "./components/Icons";
import { Sheet } from "./components/Sheet";
import { Stats } from "./components/Stats";
import { TabBar } from "./components/TabBar";
import { TelegramLogin } from "./components/TelegramLogin";
import { TaskEditor } from "./components/TaskEditor";
import { TaskList } from "./components/TaskList";
import { TopBar } from "./components/TopBar";
import { getDefaultSettings, loadState, saveState } from "./storage/persist";
import { loadTelegramLogin, saveTelegramLogin, type TelegramLoginData } from "./storage/telegramLogin";
import { hapticNotify, hapticSelection, setHapticsEnabled } from "./telegram/haptics";
import { getWebApp } from "./telegram/getWebApp";
import type { Settings, TabKey, Task } from "./types";
import { newId } from "./utils/ids";

function newTask(): Task {
  const now = Date.now();
  return {
    id: newId(),
    title: "",
    notes: "",
    tags: [],
    priority: "medium",
    dueAt: null,
    remindAt: null,
    remindedAt: null,
    pinned: false,
    done: false,
    createdAt: now,
    updatedAt: now,
    doneAt: null,
    subtasks: []
  };
}

function reorder<T extends { id: string }>(list: T[], fromId: string, toId: string) {
  const from = list.findIndex((x) => x.id === fromId);
  const to = list.findIndex((x) => x.id === toId);
  if (from < 0 || to < 0) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function mergeTasksByLatest(localTasks: Task[], serverTasks: Task[]) {
  const byId = new Map<string, Task>();
  for (const task of localTasks) {
    byId.set(task.id, task);
  }
  for (const task of serverTasks) {
    const existing = byId.get(task.id);
    if (!existing) {
      byId.set(task.id, task);
      continue;
    }
    const existingUpdatedAt = Number(existing.updatedAt ?? 0);
    const incomingUpdatedAt = Number(task.updatedAt ?? 0);
    byId.set(task.id, incomingUpdatedAt >= existingUpdatedAt ? task : existing);
  }
  return Array.from(byId.values());
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("tasks");
  const [{ tasks: initialTasks, settings: initialSettings }] = useState(() => loadState());
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const tasksRef = useRef<Task[]>(tasks);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTask, setEditorTask] = useState<Task>(() => newTask());

  const [settingsOpen, setSettingsOpen] = useState(false);

  const tg = getWebApp();
  const initData = tg?.initData ?? "";
  const [loginData, setLoginData] = useState<TelegramLoginData | null>(() => loadTelegramLogin());

  const auth = useMemo<SyncAuth | null>(() => {
    if (initData) return { type: "initData", initData };
    if (loginData) return { type: "login", loginData };
    return null;
  }, [initData, loginData]);

  const canSync = Boolean(auth);
  const canSendData = Boolean(tg?.sendData);
  const botUsername = String((import.meta as any).env?.VITE_TG_BOT_USERNAME ?? "").trim();
  const user = tg?.initDataUnsafe?.user ?? loginData ?? null;

  const [sync, setSync] = useState<{
    state: "idle" | "syncing" | "ok" | "error";
    message: string;
    lastAt: number | null;
  }>({ state: "idle", message: "", lastAt: null });
  const [serverMergeReady, setServerMergeReady] = useState(false);

  useEffect(() => {
    setServerMergeReady(!auth);
  }, [auth]);

  useEffect(() => {
    setHapticsEnabled(settings.vibrate);
  }, [settings.vibrate]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    saveState(tasks, settings);
  }, [tasks, settings]);

  const pullFromServer = useCallback(async () => {
    if (!auth) return;
    setSync({ state: "syncing", message: "Downloading...", lastAt: sync.lastAt });
    try {
      const serverTasks = await fetchTasksFromServer(auth, settings.apiBaseUrl);
      setTasks((prev) => mergeTasksByLatest(prev, serverTasks));
      setSync({ state: "ok", message: "Downloaded", lastAt: Date.now() });
      hapticNotify("success");
    } catch (e: any) {
      setSync({ state: "error", message: String(e?.message ?? e), lastAt: sync.lastAt });
      hapticNotify("error");
    }
  }, [auth, settings.apiBaseUrl, sync.lastAt]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const run = async () => {
      setSync((prev) => ({
        state: "syncing",
        message: "Syncing from server...",
        lastAt: prev.lastAt
      }));
      try {
        const serverTasks = await fetchTasksFromServer(auth, settings.apiBaseUrl);
        if (cancelled) return;
        setTasks((prev) => mergeTasksByLatest(prev, serverTasks));
        setServerMergeReady(true);
        setSync({ state: "ok", message: "Server synced", lastAt: Date.now() });
      } catch (e: any) {
        if (cancelled) return;
        setServerMergeReady(true);
        setSync((prev) => ({
          state: "error",
          message: String(e?.message ?? e),
          lastAt: prev.lastAt
        }));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [auth, settings.apiBaseUrl]);

  const pushToServer = useCallback(
    async (reason: "auto" | "manual") => {
      if (!auth) return;
      setSync({
        state: "syncing",
        message: reason === "auto" ? "Auto sync..." : "Uploading...",
        lastAt: sync.lastAt
      });
      try {
        await pushTasksToServer(auth, settings.apiBaseUrl, tasksRef.current);
        setSync({ state: "ok", message: "Synced", lastAt: Date.now() });
        if (reason === "manual") hapticNotify("success");
      } catch (e: any) {
        setSync({ state: "error", message: String(e?.message ?? e), lastAt: sync.lastAt });
        if (reason === "manual") hapticNotify("error");
      }
    },
    [auth, settings.apiBaseUrl, sync.lastAt]
  );

  useEffect(() => {
    if (!settings.autoSync) return;
    if (!auth) return;
    if (!serverMergeReady) return;
    const t = window.setTimeout(() => {
      void pushToServer("auto");
    }, 1200);
    return () => window.clearTimeout(t);
  }, [tasks, settings.autoSync, auth, pushToServer, serverMergeReady]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (filter === "active") return !t.done;
        if (filter === "done") return t.done;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.tags.some((x) => x.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.done !== b.done) return a.done ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      });
  }, [tasks, query, filter]);

  const openNew = useCallback(() => {
    setEditorTask(newTask());
    setEditorOpen(true);
    hapticSelection();
  }, []);

  const openEdit = useCallback(
    (id: string) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      setEditorTask(t);
      setEditorOpen(true);
      hapticSelection();
    },
    [tasks]
  );

  const onSaveTask = useCallback((task: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      if (!exists) return [task, ...prev];
      return prev.map((t) => (t.id === task.id ? task : t));
    });
    setEditorOpen(false);
    hapticNotify("success");
  }, []);

  const onDeleteTask = useCallback((id: string) => {
    const ok = window.confirm("Task o'chirilsinmi?");
    if (!ok) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    hapticNotify("warning");
  }, []);

  const onToggleDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        const now = Date.now();
        return { ...t, done, doneAt: done ? now : null, updatedAt: now };
      })
    );
  }, []);

  const onReorder = useCallback((fromId: string, toId: string) => {
    setTasks((prev) => reorder(prev, fromId, toId));
    hapticSelection();
  }, []);

  // Telegram bottom buttons (Main/Back/Settings)
  useEffect(() => {
    if (!tg) return;

    const onMain = () => openNew();
    try {
      tg.MainButton.setText("➕ Task qo'shish").show().enable();
      tg.MainButton.onClick(onMain);
    } catch {
      // ignore
    }

    return () => {
      try {
        tg.MainButton.offClick(onMain);
      } catch {
        // ignore
      }
    };
  }, [tg, openNew]);

  useEffect(() => {
    if (!tg) return;

    const onBack = () => {
      if (settingsOpen) setSettingsOpen(false);
      else if (editorOpen) setEditorOpen(false);
      hapticSelection();
    };

    try {
      if (settingsOpen || editorOpen) tg.BackButton.show();
      else tg.BackButton.hide();
      tg.BackButton.onClick(onBack);
    } catch {
      // ignore
    }

    return () => {
      try {
        tg.BackButton.offClick(onBack);
      } catch {
        // ignore
      }
    };
  }, [tg, settingsOpen, editorOpen]);

  useEffect(() => {
    if (!tg?.SettingsButton) return;
    const onSettings = () => setSettingsOpen(true);
    try {
      tg.SettingsButton.show();
      tg.SettingsButton.onClick(onSettings);
    } catch {
      // ignore
    }
    return () => {
      try {
        tg.SettingsButton?.offClick(onSettings);
      } catch {
        // ignore
      }
    };
  }, [tg]);

  const subtitle = useMemo(() => {
    const done = tasks.filter((t) => t.done).length;
    const total = tasks.length;
    const overdue = tasks.filter((t) => !t.done && t.dueAt && t.dueAt < Date.now()).length;
    const parts = [`${done}/${total} done`];
    if (overdue) parts.push(`${overdue} overdue`);
    return parts.join(" • ");
  }, [tasks]);

  const lastSyncLabel = useMemo(() => {
    return sync.lastAt ? new Date(sync.lastAt).toLocaleString() : "never";
  }, [sync.lastAt]);

  return (
    <div className="app">
      <TopBar
        title="ToDo Mini App"
        subtitle={subtitle}
        user={user}
        right={
          <button className="btn ghost" onClick={() => setSettingsOpen(true)} type="button">
            <span className="row gapSm">
              <IconSpark size={18} />
              Settings
            </span>
          </button>
        }
      />

      <div className="content">
        <TabBar tab={tab} onChange={setTab} />

        {tab === "tasks" ? (
          <div className="stack">
            <div className="card">
              <div className="rowBetween gap">
                <input
                  className="input search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Qidirish..."
                />
                <select
                  className="input select"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {visible.length ? (
              <TaskList
                tasks={visible}
                onToggleDone={onToggleDone}
                onEdit={openEdit}
                onDelete={onDeleteTask}
                onReorder={onReorder}
              />
            ) : (
              <div className="empty">
                <div className="emptyTitle">Hali task yo'q.</div>
                <div className="muted">➕ bosib birinchi task'ni qo'shing.</div>
              </div>
            )}

            <button className="fab" onClick={openNew} aria-label="Add task" type="button">
              <IconPlus size={22} />
            </button>
          </div>
        ) : null}

        {tab === "stats" ? <Stats tasks={tasks} /> : null}
        {tab === "focus" ? <Focus /> : null}
      </div>

      <Sheet
        open={editorOpen}
        title={editorTask.title ? "Task tahrirlash" : "Yangi task"}
        onClose={() => setEditorOpen(false)}
      >
        <TaskEditor initial={editorTask} onSave={onSaveTask} />
      </Sheet>

      <Sheet open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <div className="form">
          <label className="field inline">
            <input
              type="checkbox"
              checked={settings.vibrate}
              onChange={(e) => setSettings((s) => ({ ...s, vibrate: e.target.checked }))}
            />
            <span>Vibration/Haptic</span>
          </label>
          <label className="field inline">
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => setSettings((s) => ({ ...s, autoSync: e.target.checked }))}
            />
            <span>Auto sync (server)</span>
          </label>
          <label className="field">
            <div className="label">API Base URL (ixtiyoriy)</div>
            <input
              className="input"
              value={settings.apiBaseUrl}
              onChange={(e) => setSettings((s) => ({ ...s, apiBaseUrl: e.target.value }))}
              placeholder="Masalan: https://your-domain.com"
            />
            <div className="muted">Dev'da bo'sh qoldirsangiz `/api` proxy ishlaydi.</div>
          </label>

          <div className="card">
            <div className="rowBetween">
              <div className="kpiLabel">Server Sync</div>
              <div className="chip tiny">
                {initData ? "initData: OK" : loginData ? "login: OK" : "auth: none"}
              </div>
            </div>
            {!initData ? (
              <div className="muted" style={{ marginTop: 8 }}>
                Telegram ichida ochilmagan. Browser uchun Telegram login kerak.
              </div>
            ) : null}
            {!initData && !loginData ? (
              <div style={{ marginTop: 10 }}>
                {botUsername ? (
                  <TelegramLogin
                    botUsername={botUsername}
                    onAuth={(data) => {
                      setLoginData(data);
                      saveTelegramLogin(data);
                      hapticNotify("success");
                    }}
                  />
                ) : (
                  <div className="muted">`VITE_TG_BOT_USERNAME` yo'q (Vite env).</div>
                )}
              </div>
            ) : null}
            {!initData && loginData ? (
              <div className="row gap" style={{ marginTop: 10 }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setLoginData(null);
                    saveTelegramLogin(null);
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
            <div className="muted">
              Status: {sync.state}
              {sync.message ? ` • ${sync.message}` : ""} • Last: {lastSyncLabel}
            </div>
            <div className="row gap" style={{ marginTop: 10 }}>
              <button className="btn ghost" type="button" disabled={!canSync} onClick={pullFromServer}>
                Download
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={!canSync}
                onClick={() => void pushToServer("manual")}
              >
                Upload
              </button>
            </div>
          </div>

          <div className="row gap">
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                const ok = window.confirm("Hamma task'lar o'chirilsinmi?");
                if (!ok) return;
                setTasks([]);
                setSettings(getDefaultSettings());
              }}
            >
              Reset
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                if (!tg?.sendData) {
                  window.alert(
                    "sendData ishlamadi. Mini App'ni Telegram ichida (keyboard button orqali) oching."
                  );
                  return;
                }
                try {
                  tg.sendData(JSON.stringify({ type: "export", tasks }));
                  hapticNotify("success");
                } catch (e: any) {
                  window.alert(String(e?.message ?? e));
                }
                setSettingsOpen(false);
              }}
            >
              Bot'ga yuborish (sendData)
            </button>
          </div>
          <div className="muted">
            sendData: {canSendData ? "available" : "not available"} (browser'da odatda yo'q)
          </div>
        </div>
      </Sheet>
    </div>
  );
}
