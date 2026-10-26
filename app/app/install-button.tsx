"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "ready">("unknown");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return setState("installed");
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setState("ios");
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setState("ready");
    };
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setState("installed");
    setPrompt(null);
  }

  return (
    <div className="install-cta">
      {state === "ready" ? <button className="site-button" onClick={() => void install()}>App installieren</button> : null}
      {state === "installed" ? <div className="install-hint">Die App ist installiert. Öffnen Sie LOGIPAY vom Startbildschirm.</div> : null}
      {state === "ios" ? <div className="install-hint">iPhone: Teilen-Symbol □↑ unten in Safari → „Zum Home-Bildschirm“.</div> : null}
      <a className="site-button site-button-ghost" href="/login">Zur Anmeldung</a>
    </div>
  );
}
