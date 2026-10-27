"use client";

import { useEffect, useState } from "react";

/** Call after a driver finished something important; shows a big animated check and vibrates once. */
export function celebrate(label: string) {
  window.dispatchEvent(new CustomEvent("logipay-success", { detail: label }));
}

export function SuccessBurst() {
  const [shown, setShown] = useState<{ label: string; key: number } | null>(null);
  useEffect(() => {
    let timer = 0;
    const onSuccess = (event: Event) => {
      const label = String((event as CustomEvent).detail || "");
      try { navigator.vibrate?.([18, 40, 28]); } catch { /* not supported on iPhone */ }
      setShown({ label, key: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShown(null), 1500);
    };
    window.addEventListener("logipay-success", onSuccess);
    return () => { window.removeEventListener("logipay-success", onSuccess); window.clearTimeout(timer); };
  }, []);
  if (!shown) return null;
  return (
    <div className="success-burst" key={shown.key} role="status" aria-live="polite" onClick={() => setShown(null)}>
      <div className="success-card">
        <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" /><path d="M19 33l9 9 17-19" /></svg>
        <b>{shown.label}</b>
      </div>
      {Array.from({ length: 10 }, (_, index) => <i key={index} style={{ ["--a" as string]: `${index * 36}deg` }} />)}
    </div>
  );
}
