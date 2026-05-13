import React, { useEffect, useMemo, useRef, useState } from "react";
import { hapticSelection } from "../telegram/haptics";
import { clamp } from "../utils/time";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Focus() {
  const [minutes, setMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setLeft(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const startLeft = left;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setLeft(Math.max(0, startLeft - elapsed));
      tickRef.current = window.setTimeout(tick, 250);
    };
    tick();

    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (running && left === 0) {
      setRunning(false);
      hapticSelection();
    }
  }, [left, running]);

  const progress = useMemo(() => {
    const total = minutes * 60;
    return total === 0 ? 0 : 1 - left / total;
  }, [left, minutes]);

  return (
    <div className="focus">
      <div className="card focusCard">
        <div className="focusTime">{fmt(left)}</div>
        <div className="bar">
          <div className="barFill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div className="rowBetween">
          <div className="muted">Pomodoro</div>
          <div className="chip tiny">{minutes} min</div>
        </div>

        <div className="row gap">
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setMinutes((m) => clamp(m - 5, 5, 90));
              hapticSelection();
            }}
          >
            -5
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setMinutes((m) => clamp(m + 5, 5, 90));
              hapticSelection();
            }}
          >
            +5
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              setRunning((r) => !r);
              hapticSelection();
            }}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setRunning(false);
              setLeft(minutes * 60);
              hapticSelection();
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

