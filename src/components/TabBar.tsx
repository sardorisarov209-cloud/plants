import React from "react";
import type { TabKey } from "../types";

export function TabBar({
  tab,
  onChange
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <div className="tabs">
      <button
        className={`tab ${tab === "tasks" ? "active" : ""}`}
        onClick={() => onChange("tasks")}
        type="button"
      >
        Tasks
      </button>
      <button
        className={`tab ${tab === "stats" ? "active" : ""}`}
        onClick={() => onChange("stats")}
        type="button"
      >
        Statistika
      </button>
      <button
        className={`tab ${tab === "focus" ? "active" : ""}`}
        onClick={() => onChange("focus")}
        type="button"
      >
        Focus
      </button>
    </div>
  );
}

