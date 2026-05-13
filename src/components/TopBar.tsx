import React from "react";
import { getWebApp } from "../telegram/getWebApp";

export function TopBar({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  const tg = getWebApp();
  const user = tg?.initDataUnsafe?.user;
  const name = user?.first_name ? `${user.first_name}` : "Guest";
  const uname = user?.username ? `@${user.username}` : "";

  return (
    <div className="topbar">
      <div>
        <div className="titleRow">
          <h1 className="title">{title}</h1>
          <div className="chip tiny">{name}</div>
        </div>
        <div className="subtitle">
          {subtitle}
          {uname ? ` • ${uname}` : ""}
        </div>
      </div>
      <div className="topbarRight">{right}</div>
    </div>
  );
}

