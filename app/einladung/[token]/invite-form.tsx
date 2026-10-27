"use client";

import { FormEvent, useState } from "react";

type Lang = "de" | "pl" | "uk" | "ru";
const t: Record<Lang, Record<string, string>> = {
  de: { hello: "Hallo", invited: "lädt Sie zur LOGIPAY Fahrer-App ein.", login: "Ihr Login", password: "Neues Passwort", repeat: "Passwort wiederholen", hint: "Mindestens 10 Zeichen, ein Großbuchstabe und eine Zahl.", start: "Passwort speichern", mismatch: "Die Passwörter stimmen nicht überein.", invalid: "Diese Einladung ist abgelaufen oder wurde schon benutzt. Bitte bei Ihrer Firma eine neue Einladung anfordern.", done: "Fertig! Jetzt die App installieren.", install: "App installieren", busy: "Wird gespeichert …" },
  pl: { hello: "Cześć", invited: "zaprasza Cię do aplikacji kierowcy LOGIPAY.", login: "Twój login", password: "Nowe hasło", repeat: "Powtórz hasło", hint: "Co najmniej 10 znaków, wielka litera i cyfra.", start: "Zapisz hasło", mismatch: "Hasła nie są takie same.", invalid: "To zaproszenie wygasło lub zostało już użyte. Poproś firmę o nowe zaproszenie.", done: "Gotowe! Teraz zainstaluj aplikację.", install: "Zainstaluj aplikację", busy: "Zapisywanie …" },
  uk: { hello: "Привіт", invited: "запрошує вас до застосунку водія LOGIPAY.", login: "Ваш логін", password: "Новий пароль", repeat: "Повторіть пароль", hint: "Щонайменше 10 символів, велика літера та цифра.", start: "Зберегти пароль", mismatch: "Паролі не збігаються.", invalid: "Це запрошення прострочене або вже використане. Попросіть у фірми нове запрошення.", done: "Готово! Тепер встановіть застосунок.", install: "Встановити застосунок", busy: "Збереження …" },
  ru: { hello: "Привет", invited: "приглашает вас в приложение водителя LOGIPAY.", login: "Ваш логин", password: "Новый пароль", repeat: "Повторите пароль", hint: "Минимум 10 символов, заглавная буква и цифра.", start: "Сохранить пароль", mismatch: "Пароли не совпадают.", invalid: "Это приглашение истекло или уже использовано. Попросите у фирмы новое приглашение.", done: "Готово! Теперь установите приложение.", install: "Установить приложение", busy: "Сохранение …" },
};

export function InviteForm({ token, valid, name, email, company }: { token: string; valid: boolean; name: string; email: string; company: string }) {
  const [lang, setLang] = useState<Lang>("de");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const c = t[lang];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("repeat")) return setError(c.mismatch);
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error || c.invalid);
    try { localStorage.setItem("logipay_driver_locale", lang); } catch { /* optional */ }
    setDone(true);
  }

  return (
    <main className="app-gate invite-page" lang={lang}>
      <div className="app-gate-languages" role="group">
        {(["de", "pl", "uk", "ru"] as Lang[]).map((code) => <button key={code} type="button" className={code === lang ? "active" : ""} onClick={() => setLang(code)}>{code === "uk" ? "UA" : code.toUpperCase()}</button>)}
      </div>
      <img src="/icon-192.png" alt="" width={80} height={80} className="app-gate-icon" />
      {!valid ? <><h1>LOGIPAY</h1><p>{c.invalid}</p></> : done ? <>
        <h1>{c.done}</h1>
        <p>{c.login}: <b>{email}</b></p>
        <a className="site-button" href="/app">{c.install}</a>
      </> : <>
        <h1>{c.hello}, {name.split(" ")[0]}!</h1>
        <p><b>{company}</b> {c.invited}</p>
        <form className="invite-form" onSubmit={submit}>
          <label>{c.login}<input value={email} readOnly autoComplete="username" /></label>
          <label>{c.password}<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
          <label>{c.repeat}<input name="repeat" type="password" autoComplete="new-password" minLength={10} required /></label>
          <small>{c.hint}</small>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="site-button" type="submit" disabled={busy}>{busy ? c.busy : c.start}</button>
        </form>
      </>}
    </main>
  );
}
