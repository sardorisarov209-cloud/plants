import React, { useMemo } from "react";
import type { Task } from "../types";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function Stats({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const active = total - done;
    const pinned = tasks.filter((t) => t.pinned).length;
    const overdue = tasks.filter((t) => !t.done && t.dueAt && t.dueAt < Date.now()).length;
    const completion = total === 0 ? 0 : done / total;
    return { total, done, active, pinned, overdue, completion };
  }, [tasks]);

  return (
    <div className="stats">
      <div className="card grid">
        <div>
          <div className="kpiLabel">Total</div>
          <div className="kpi">{data.total}</div>
        </div>
        <div>
          <div className="kpiLabel">Done</div>
          <div className="kpi good">{data.done}</div>
        </div>
        <div>
          <div className="kpiLabel">Active</div>
          <div className="kpi">{data.active}</div>
        </div>
        <div>
          <div className="kpiLabel">Overdue</div>
          <div className="kpi bad">{data.overdue}</div>
        </div>
      </div>

      <div className="card">
        <div className="rowBetween">
          <div className="kpiLabel">Completion</div>
          <div className="chip">{pct(data.completion)}</div>
        </div>
        <div className="bar">
          <div className="barFill" style={{ width: pct(data.completion) }} />
        </div>
        <div className="muted">Pinned: {data.pinned}</div>
      </div>
    </div>
  );
}

