"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function LoginForm({ notice = "" }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(notice);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeStep, setCodeStep] = useState<{ email: string } | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [message, setMessage] = useState("");

  async function send(extra: { code?: string; resend?: boolean } = {}) {
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberDevice, ...extra }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? await response.json() as { error?: string; requiresCode?: boolean; email?: string; sent?: boolean }
      : { error: "Anmeldeserver vorübergehend nicht erreichbar. Bitte erneut versuchen." };
    setLoading(false);
    if (result.requiresCode) {
      setCodeStep({ email: result.email || email });
      setCode("");
      if (response.status === 202) setMessage(result.sent === false ? "Ein Code wurde gerade erst gesendet – bitte Posteingang prüfen." : `Code gesendet an ${result.email}`);
      if (!response.ok) setError(result.error ?? "Falscher Code");
      return;
    }
    if (!response.ok) {
      setError(result.error ?? "Anmeldung fehlgeschlagen");
      return;
    }
    window.location.href = "/";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await send(codeStep ? { code } : {});
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
          {codeStep ? <>
            <h2>Code eingeben</h2>
            <p>Wir haben einen 6-stelligen Code an <b>{codeStep.email}</b> gesendet. Er ist 10 Minuten gültig.</p>
            <label className="code-field">Anmeldecode<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="••••••" autoFocus required /></label>
            <label className="remember-device"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} /><span>Dieses Gerät 30 Tage merken</span></label>
          </> : <>
            <h2>Anmeldung</h2>
            <p>Bitte Firmenkonto verwenden</p>
            <label>E-Mail<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@firma.de" required /></label>
            <label>Passwort<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Passwort eingeben" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}>{showPassword ? "Ausblenden" : "Anzeigen"}</button></div></label>
          </>}
          {error ? <div className="login-error">{error}</div> : null}
          {message ? <div className="login-message-box">{message}</div> : null}
          <button className="login-submit" type="submit" disabled={loading || (Boolean(codeStep) && code.length !== 6)}>{loading ? "Wird geprüft …" : codeStep ? "Bestätigen" : "Weiter"}<span>→</span></button>
          {codeStep ? <div className="login-help"><button type="button" onClick={() => void send({ resend: true })} disabled={loading}>Neuen Code senden</button><span>·</span><button type="button" onClick={() => { setCodeStep(null); setError(""); setMessage(""); }}>Zurück</button></div>
            : <div className="login-help"><span>Kein Zugang?</span><button type="button" onClick={requestReset}>Passwort zurücksetzen anfordern</button></div>}
          <div className="login-register">Neu bei LOGIPAY? <Link href="/registrieren">Firma kostenlos registrieren</Link></div>
          <div className="login-footer"><Link href="/">LOGIPAY</Link> · <Link href="/app">Fahrer-App</Link> · <Link href="/impressum">Impressum</Link> · <Link href="/datenschutz">Datenschutz</Link></div>
        </form>
      </section>
    </main>
  );
}
