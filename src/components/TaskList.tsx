import { AnimatePresence } from "framer-motion";
import React from "react";
import type { Task } from "../types";
import { TaskItem } from "./TaskItem";

export function TaskList({
  tasks,
  onToggleDone,
  onEdit,
  onDelete,
  onReorder
}: {
  tasks: Task[];
  onToggleDone: (id: string, ev?: React.MouseEvent) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  return (
    <ul
      className="taskList"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/task-id");
        const target = (e.target as HTMLElement).closest("[data-task-id]") as
          | HTMLElement
          | null;
        const toId = target?.dataset?.taskId ?? "";
        if (fromId && toId && fromId !== toId) onReorder(fromId, toId);
      }}
      onDragStart={(e) => {
        const el = (e.target as HTMLElement).closest("[data-task-id]") as
          | HTMLElement
          | null;
        const id = el?.dataset?.taskId;
        if (!id) return;
        e.dataTransfer.setData("text/task-id", id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            onToggleDone={onToggleDone}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

