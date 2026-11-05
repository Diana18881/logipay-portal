"use client";

import { useEffect, useState } from "react";

// Cookie notice for the public site. LOGIPAY only sets technically necessary cookies (login, "remember device"),
// so this informs instead of asking for consent (§ 25 Abs. 2 TDDDG). The choice is remembered in this browser.
const KEY = "logipay_cookie_notice";
const OPEN_EVENT = "logipay:cookie-notice";

export function CookieNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch { /* storage blocked: show the notice */ }
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    if (seen) return () => window.removeEventListener(OPEN_EVENT, reopen);
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => { window.clearTimeout(timer); window.removeEventListener(OPEN_EVENT, reopen); };
  }, []);
  if (!open) return null;
  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* optional */ }
    setOpen(false);
  };
  return (
    <div className="cookie-notice" role="dialog" aria-live="polite" aria-label="Hinweis zu Cookies">
      <span className="cookie-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3Z" /><circle cx="8.5" cy="11" r="1" fill="currentColor" /><circle cx="12" cy="16" r="1" fill="currentColor" /><circle cx="15.5" cy="13" r="1" fill="currentColor" /></svg>
      </span>
      <div className="cookie-text">
        <b>Cookies</b>
        <p>Wir verwenden nur technisch notwendige Cookies – für die Anmeldung und um Ihr Gerät zu merken. Kein Tracking, keine Werbung.</p>
      </div>
      <div className="cookie-actions">
        <a href="/datenschutz#cookies">Mehr erfahren</a>
        <button type="button" onClick={close}>Verstanden</button>
      </div>
    </div>
  );
}

/** Footer link that shows the cookie notice again. */
export function CookieNoticeLink() {
  return <button type="button" className="site-footer-link" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>Cookie-Hinweis</button>;
}
