import React, { useMemo, useState } from "react";
import type { Priority, Subtask, Task } from "../types";
import { newId } from "../utils/ids";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../utils/time";

function normalizeTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function priorityFrom(p: string): Priority {
  if (p === "high" || p === "medium" || p === "low") return p;
  return "medium";
}

export function TaskEditor({
  initial,
  onSave
}: {
  initial: Task;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [tagsRaw, setTagsRaw] = useState(initial.tags.join(", "));
  const [priority, setPriority] = useState<Priority>(initial.priority);
  const [due, setDue] = useState<string>(
    initial.dueAt ? toDatetimeLocalValue(initial.dueAt) : ""
  );
  const [remind, setRemind] = useState<string>(
    initial.remindAt ? toDatetimeLocalValue(initial.remindAt) : ""
  );
  const [pinned, setPinned] = useState(initial.pinned);
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial.subtasks ?? []);

  const tags = useMemo(() => normalizeTags(tagsRaw), [tagsRaw]);

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;

        const now = Date.now();
        const dueAt = due ? fromDatetimeLocalValue(due) : null;
        const remindAt = remind ? fromDatetimeLocalValue(remind) : null;

        onSave({
          ...initial,
          title: trimmed,
          notes: notes.trim(),
          tags,
          priority: priorityFrom(priority),
          dueAt,
          remindAt,
          pinned,
          subtasks,
          updatedAt: now
        });
      }}
    >
      <label className="field">
        <div className="label">Title</div>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: Bugun 10ta task..."
          autoFocus
        />
      </label>

      <label className="field">
        <div className="label">Notes</div>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Qoshimcha izoh..."
          rows={3}
        />
      </label>

      <div className="grid2">
        <label className="field">
          <div className="label">Due</div>
          <input
            className="input"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <label className="field">
          <div className="label">Reminder</div>
          <input
            className="input"
            type="datetime-local"
            value={remind}
            onChange={(e) => setRemind(e.target.value)}
          />
        </label>
      </div>

      <div className="grid2">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Priority</div>
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(priorityFrom(e.target.value))}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label className="field">
        <div className="label">Tags (comma)</div>
        <input
          className="input"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="work, study, gym"
        />
      </label>

      <label className="field inline">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
        />
        <span>Pin</span>
      </label>

      <div className="subtasks">
        <div className="label">Subtasks</div>
        <div className="subtaskList">
          {subtasks.map((s) => (
            <label className="subtask" key={s.id}>
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) =>
                  setSubtasks((prev) =>
                    prev.map((p) =>
                      p.id === s.id ? { ...p, done: e.target.checked } : p
                    )
                  )
                }
              />
              <input
                className="subInput"
                value={s.title}
                onChange={(e) =>
                  setSubtasks((prev) =>
                    prev.map((p) => (p.id === s.id ? { ...p, title: e.target.value } : p))
                  )
                }
                placeholder="Subtask..."
              />
              <button
                className="btn tiny ghost"
                type="button"
                onClick={() => setSubtasks((prev) => prev.filter((p) => p.id !== s.id))}
              >
                O'chirish
              </button>
            </label>
          ))}
          <button
            className="btn ghost"
            type="button"
            onClick={() =>
              setSubtasks((prev) => [...prev, { id: newId(), title: "", done: false }])
            }
          >
            + Subtask
          </button>
        </div>
      </div>

      <div className="actionsRow">
        <button className="btn primary" type="submit">
          Saqlash
        </button>
      </div>
    </form>
  );
}
