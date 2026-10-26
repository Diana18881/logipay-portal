"use client";

import { useEffect } from "react";

/** Registers the offline/push service worker on every page, so the app is installable from anywhere. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
