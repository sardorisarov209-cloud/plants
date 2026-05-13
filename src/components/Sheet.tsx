import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { useEffect } from "react";

export function Sheet({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
          >
            <div className="sheetHeader">
              <div className="sheetGrab" />
              <div className="sheetTitleRow">
                <h2 className="sheetTitle">{title}</h2>
                <button className="btn ghost" onClick={onClose} type="button">
                  Yopish
                </button>
              </div>
            </div>
            <div className="sheetBody">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

