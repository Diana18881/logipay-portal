"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "ready">("unknown");
  const [qr, setQr] = useState("");

  useEffect(() => {
    // On a computer, show a QR code so the phone can open this page directly.
    if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return;
    QRCode.toString(`${window.location.origin}/app`, { type: "svg", margin: 1, width: 180, color: { dark: "#0b1a29", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, []);

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
      {qr ? <div className="install-qr"><div dangerouslySetInnerHTML={{ __html: qr }} /><p><b>Mit dem Handy scannen</b>Kamera auf den Code richten – die Seite öffnet sich auf dem Handy, dort dann installieren.</p></div> : null}
      {state === "ready" ? <button className="site-button" onClick={() => void install()}>App installieren</button> : null}
      {state === "installed" ? <div className="install-hint">Die App ist installiert. Öffnen Sie LOGIPAY vom Startbildschirm.</div> : null}
      {state === "ios" ? <div className="install-hint">iPhone: in Safari Teilen □↑ (bei iOS 26 erst ≡ neben der Adresse) → „Zum Home-Bildschirm“.</div> : null}
      <a className="site-button site-button-ghost" href="/login">Zur Anmeldung</a>
    </div>
  );
}
