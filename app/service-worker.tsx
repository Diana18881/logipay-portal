"use client";

import { useEffect } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window { logipayInstallPrompt?: InstallPromptEvent | null }
}

/** Registers the offline/push service worker on every page and keeps the browser's install prompt for later use. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const keep = (event: Event) => {
      event.preventDefault();
      window.logipayInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event("logipay-installable"));
    };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);
  return null;
}

/** True when LOGIPAY runs as the installed app (home screen), not inside a browser tab. */
export function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Phones and tablets; drivers there must use the installed app. */
export function isMobileDevice() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent));
}
