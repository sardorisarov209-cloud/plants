import { motion } from "framer-motion";
import React from "react";
import type { Task } from "../types";
import { hapticImpact, hapticNotify } from "../telegram/haptics";
import { confettiBurst } from "../utils/confetti";
import { formatCompactDateTime } from "../utils/time";
import { IconCheck, IconEdit, IconTrash } from "./Icons";

export function TaskItem({
  task,
  onToggleDone,
  onEdit,
  onDelete,
  draggable = true
}: {
  task: Task;
  onToggleDone: (id: string, ev?: React.MouseEvent) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
}) {
  const dueLabel = task.dueAt ? formatCompactDateTime(task.dueAt) : "";
  const remindLabel = task.remindAt ? formatCompactDateTime(task.remindAt) : "";
  const remindMeta = remindLabel
    ? task.remindedAt
      ? `Reminder sent: ${remindLabel}`
      : `Reminder: ${remindLabel}`
    : "";

  const priorityLabel =
    task.priority === "high"
      ? "HIGH"
      : task.priority === "medium"
        ? "MED"
        : "LOW";

  const priorityClass =
    task.priority === "high"
      ? "pri high"
      : task.priority === "medium"
        ? "pri med"
        : "pri low";

  return (
    <motion.li
      layout
      className={`task ${task.done ? "done" : ""} ${task.pinned ? "pinned" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      draggable={draggable}
      data-task-id={task.id}
    >
      <button
        className={`check ${task.done ? "checked" : ""}`}
        onClick={(ev) => {
          if (!task.done) {
            const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
            hapticNotify("success");
          } else {
            hapticImpact("light");
          }
          onToggleDone(task.id, ev);
        }}
        aria-label={task.done ? "Undone" : "Done"}
        type="button"
      >
        <span className="checkRing" />
        <span className="checkIcon">
          <IconCheck size={16} />
        </span>
      </button>

      <div className="taskMain">
        <div className="taskTitleRow">
          <div className="taskTitle">{task.title}</div>
          <div className={priorityClass}>{priorityLabel}</div>
        </div>

        {task.notes ? <div className="taskNotes">{task.notes}</div> : null}

        <div className="taskMeta">
          {dueLabel ? <span className="meta">Due: {dueLabel}</span> : null}
          {remindMeta ? <span className="meta">{remindMeta}</span> : null}
          {task.tags?.length ? <span className="meta">Tags: {task.tags.join(", ")}</span> : null}
          {task.subtasks?.length ? (
            <span className="meta">
              {task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length} subtasks
            </span>
          ) : null}
        </div>
      </div>

      <div className="taskActions">
        <button className="iconBtn" onClick={() => onEdit(task.id)} aria-label="Edit" type="button">
          <IconEdit size={18} />
        </button>
        <button
          className="iconBtn danger"
          onClick={() => onDelete(task.id)}
          aria-label="Delete"
          type="button"
        >
          <IconTrash size={18} />
        </button>
      </div>
    </motion.li>
  );
}
