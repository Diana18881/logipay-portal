"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function RegisterForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.get("companyName"),
        fullName: form.get("fullName"),
        email: form.get("email"),
        password: form.get("password"),
        acceptTerms: form.get("acceptTerms") === "on",
        website: form.get("website"),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Registrierung fehlgeschlagen");
      setLoading(false);
      return;
    }
    window.location.href = "/?willkommen=1";
  }

  return (
    <form className="register-card" onSubmit={submit}>
      <h2>Firma registrieren</h2>
      <label>Firmenname<input name="companyName" autoComplete="organization" required maxLength={120} placeholder="Muster Transporte GmbH" /></label>
      <label>Ihr Name<input name="fullName" autoComplete="name" required maxLength={120} placeholder="Vor- und Nachname" /></label>
      <label>Geschäftliche E-Mail<input name="email" type="email" autoComplete="email" required placeholder="name@firma.de" /></label>
      <label>Passwort<input name="password" type="password" autoComplete="new-password" required minLength={10} placeholder="Mind. 10 Zeichen, Großbuchstabe und Zahl" /></label>
      <input className="register-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="register-terms"><input name="acceptTerms" type="checkbox" required /><span>Ich akzeptiere die <Link href="/agb" target="_blank">AGB</Link> und den <Link href="/avv" target="_blank">Vertrag zur Auftragsverarbeitung</Link> und habe die <Link href="/datenschutz" target="_blank">Datenschutzhinweise</Link> gelesen.</span></label>
      {error ? <div className="login-error">{error}</div> : null}
      <button className="login-submit" type="submit" disabled={loading}>{loading ? "Portal wird eingerichtet …" : "Kostenlos starten"}<span>→</span></button>
      <p className="register-login">Schon registriert? <Link href="/login">Anmelden</Link></p>
    </form>
  );
}
