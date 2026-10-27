"use client";

import { useEffect, useState } from "react";

/** Dark launch screen for the installed app; visible only in standalone mode until the page is ready. */
export function AppSplash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGone(true), 650);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className={`app-splash ${gone ? "app-splash-gone" : ""}`} aria-hidden="true">
      <img src="/icon-192.png" alt="" width={96} height={96} />
      <b>LOGIPAY</b>
      <i />
    </div>
  );
}
