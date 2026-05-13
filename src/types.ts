export type Priority = "low" | "medium" | "high";

export type TabKey = "tasks" | "stats" | "focus";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  priority: Priority;
  dueAt: number | null;
  pinned: boolean;
  done: boolean;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
  subtasks: Subtask[];
}

export interface Settings {
  vibrate: boolean;
  autoSync: boolean;
  apiBaseUrl: string;
}

export interface PersistedStateV1 {
  v: 1;
  tasks: Task[];
  settings: Settings;
}

