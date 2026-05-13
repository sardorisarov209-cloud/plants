import { getWebApp } from "./getWebApp";

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function hapticSelection() {
  if (!enabled) return;
  const tg = getWebApp();
  tg?.HapticFeedback?.selectionChanged?.();
}

export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft") {
  if (!enabled) return;
  const tg = getWebApp();
  tg?.HapticFeedback?.impactOccurred?.(style);
}

export function hapticNotify(type: "error" | "success" | "warning") {
  if (!enabled) return;
  const tg = getWebApp();
  tg?.HapticFeedback?.notificationOccurred?.(type);
}
