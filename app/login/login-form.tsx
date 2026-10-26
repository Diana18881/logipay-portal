"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function LoginForm({ notice = "" }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(notice);
  const [loading, setLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactor, setTwoFactor] = useState<{ setup?: boolean; secret?: string } | null>(null);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setTwoFactor(null);
    setTwoFactorCode("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, twoFactorCode }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? await response.json() as { error?: string; requiresTwoFactor?: boolean; setup?: boolean; secret?: string }
      : { error: "Anmeldeserver vorübergehend nicht erreichbar. Bitte erneut versuchen." };
    if (result.requiresTwoFactor && response.status === 202) {
      setTwoFactor({ setup: result.setup, secret: result.secret });
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setError(result.error ?? "Anmeldung fehlgeschlagen");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  async function requestReset() {
    setError("");
    if (!email) return setError("Bitte zuerst Ihre E-Mail eingeben");
    const response = await fetch("/api/auth/reset-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json() as { message?: string; error?: string };
    if (!response.ok) setError(result.error || "Anfrage konnte nicht gesendet werden");
    else setMessage(result.message || "Anfrage wurde an die Verwaltung gesendet");
  }

  return (
    <main className="login-page" lang="de">
      <section className="login-brand">
        <div className="login-brand-content">
          <div className="login-logo"><div className="brand-mark"><span /><span /><span /></div><strong>LOGIPAY</strong></div>
          <div className="login-message">
            <p>PORTAL FÜR TRANSPORTUNTERNEHMEN</p>
            <h1>Lohn, Touren<br />und Team — <em>im Griff.</em></h1>
            <span>Ein geschützter Arbeitsbereich für Lohnabrechnung und Logistik.</span>
          </div>
          <div className="security-points">
            <div><b>01</b><span><strong>Getrennte Zugriffe</strong><small>Jede Rolle sieht nur freigegebene Daten</small></span></div>
            <div><b>02</b><span><strong>Geschützte Sitzungen</strong><small>Passwörter und Finanzdaten bleiben serverseitig geschützt</small></span></div>
            <div><b>03</b><span><strong>Nachvollziehbare Änderungen</strong><small>Jede Aktion ist dem Benutzerkonto zugeordnet</small></span></div>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="secure-label"><i /> Gesicherte Verbindung</div>
          <h2>Anmeldung</h2>
          <p>Bitte Firmenkonto verwenden</p>
          <label>E-Mail<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@firma.de" required /></label>
          <label>Passwort<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Passwort eingeben" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}>{showPassword ? "Ausblenden" : "Anzeigen"}</button></div></label>
          {twoFactor ? <div className="two-factor-box">{twoFactor.setup ? <><strong>Zwei-Faktor-Anmeldung einrichten</strong><p>Fügen Sie diesen Schlüssel in Google Authenticator, Microsoft Authenticator oder 1Password ein:</p><code>{twoFactor.secret}</code></> : <strong>Zwei-Faktor-Authentifizierung</strong>}<label>6-stelliger Code<input inputMode="numeric" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} maxLength={6} required /></label></div> : null}
          {error ? <div className="login-error">{error}</div> : null}
          {message ? <div className="login-message-box">{message}</div> : null}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Wird geprüft …" : "Im Portal anmelden"}<span>→</span></button>
          <div className="login-help"><span>Kein Zugang?</span><button type="button" onClick={requestReset}>Passwort zurücksetzen anfordern</button></div>
          <div className="login-register">Neu bei LOGIPAY? <Link href="/registrieren">Firma kostenlos registrieren</Link></div>
          <div className="login-footer"><Link href="/">LOGIPAY</Link> · <Link href="/app">Fahrer-App</Link> · <Link href="/impressum">Impressum</Link> · <Link href="/datenschutz">Datenschutz</Link></div>
        </form>
      </section>
    </main>
  );
}
