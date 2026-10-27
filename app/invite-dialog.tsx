"use client";

import { FormEvent, useState } from "react";

type Person = { id: string | number; full_name: string; login_email?: string | null };

/** Creates an invitation link for a driver and offers WhatsApp, e-mail and copy. */
export function InviteDialog({ person, close, done }: { person: Person; close: () => void; done?: () => void }) {
  const [email, setEmail] = useState(String(person.login_email || ""));
  const [link, setLink] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: person.id, email }) });
    const result = await response.json().catch(() => ({})) as { link?: string; company?: string; error?: string };
    setBusy(false);
    if (!response.ok || !result.link) return setError(result.error || "Einladung konnte nicht erstellt werden");
    setLink(result.link);
    setCompany(result.company || "");
    done?.();
  }

  const first = person.full_name.split(" ")[0];
  const message = `Hallo ${first}! ${company} nutzt LOGIPAY für Touren, Belege und Lohn. Bitte hier Passwort festlegen und die App installieren: ${link}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <div className="invite-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="invite-dialog" role="dialog" aria-label="Fahrer einladen">
        <header><div><small>FAHRER EINLADEN</small><h2>{person.full_name}</h2></div><button type="button" onClick={close} aria-label="Schließen">×</button></header>
        {!link ? <form onSubmit={create}>
          <p>Der Fahrer bekommt einen Link, legt selbst sein Passwort fest und installiert die App. Der Link gilt 14 Tage.</p>
          <label>E-Mail des Fahrers (sein Login)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={Boolean(person.login_email)} required placeholder="fahrer@beispiel.de" /></label>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Wird erstellt …" : "Einladungslink erstellen"}</button>
        </form> : <div className="invite-share">
          <p>Link senden – am einfachsten per WhatsApp:</p>
          <a className="invite-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="invite-mail" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Ihre Einladung zu LOGIPAY")}&body=${encodeURIComponent(message)}`}>E-Mail</a>
          <button type="button" onClick={() => void copy()}>{copied ? "Kopiert ✓" : "Link kopieren"}</button>
          <code>{link}</code>
        </div>}
      </div>
    </div>
  );
}
