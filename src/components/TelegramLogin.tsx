import React, { useEffect, useMemo, useRef } from "react";
import type { TelegramLoginData } from "../storage/telegramLogin";

function normalize(user: any): TelegramLoginData | null {
  if (!user || typeof user !== "object") return null;
  const id = Number(user.id);
  const auth_date = Number(user.auth_date);
  const hash = typeof user.hash === "string" ? user.hash : "";
  if (!Number.isFinite(id)) return null;
  if (!Number.isFinite(auth_date)) return null;
  if (!hash) return null;

  return {
    id,
    auth_date,
    hash,
    first_name: typeof user.first_name === "string" ? user.first_name : undefined,
    last_name: typeof user.last_name === "string" ? user.last_name : undefined,
    username: typeof user.username === "string" ? user.username : undefined,
    photo_url: typeof user.photo_url === "string" ? user.photo_url : undefined
  };
}

export function TelegramLogin({
  botUsername,
  onAuth
}: {
  botUsername: string;
  onAuth: (data: TelegramLoginData) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const callbackName = useMemo(() => "__tg_login_onAuth", []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    if (!botUsername) return;

    (window as any)[callbackName] = (user: any) => {
      const parsed = normalize(user);
      if (parsed) onAuth(parsed);
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    host.appendChild(script);

    return () => {
      try {
        delete (window as any)[callbackName];
      } catch {
        // ignore
      }
    };
  }, [botUsername, callbackName, onAuth]);

  return <div ref={hostRef} />;
}

