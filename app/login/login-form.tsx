"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactor, setTwoFactor] = useState<{ setup?: boolean; secret?: string } | null>(null);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, twoFactorCode }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? await response.json() as { error?: string; requiresTwoFactor?: boolean; setup?: boolean; secret?: string }
      : { error: "Сервер входа временно недоступен. Попробуйте ещё раз." };
    if (result.requiresTwoFactor && response.status === 202) {
      setTwoFactor({ setup: result.setup, secret: result.secret });
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setError(result.error ?? "Не удалось войти");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  async function requestReset() {
    setError("");
    if (!email) return setError("Сначала введите ваш email");
    const response = await fetch("/api/auth/reset-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json() as { message?: string; error?: string };
    if (!response.ok) setError(result.error || "Не удалось отправить запрос");
    else setMessage(result.message || "Запрос отправлен администратору");
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-brand-content">
          <div className="login-logo"><div className="brand-mark"><span /><span /><span /></div><strong>LOGIPAY</strong></div>
          <div className="login-message">
            <p>ЗАКРЫТЫЙ КОРПОРАТИВНЫЙ ПОРТАЛ</p>
            <h1>Зарплаты, рейсы<br />и команда — <em>в порядке.</em></h1>
            <span>Единое защищённое пространство для управления выплатами и логистическими операциями.</span>
          </div>
          <div className="security-points">
            <div><b>01</b><span><strong>Раздельный доступ</strong><small>Каждый сотрудник видит только разрешённые данные</small></span></div>
            <div><b>02</b><span><strong>Защищённые сессии</strong><small>Пароли и финансовые данные не передаются в браузер</small></span></div>
            <div><b>03</b><span><strong>История операций</strong><small>Изменения привязаны к учётной записи</small></span></div>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="secure-label"><i /> Защищённое соединение</div>
          <h2>Вход в систему</h2>
          <p>Используйте корпоративную учётную запись</p>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required /></label>
          <label>Пароль<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? "Скрыть" : "Показать"}</button></div></label>
          {twoFactor ? <div className="two-factor-box">{twoFactor.setup ? <><strong>Настройте двухфакторный вход</strong><p>Добавьте этот ключ в Google Authenticator, Microsoft Authenticator или 1Password:</p><code>{twoFactor.secret}</code></> : <strong>Двухфакторная авторизация</strong>}<label>6-значный код<input inputMode="numeric" autoComplete="one-time-code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} maxLength={6} required /></label></div> : null}
          {error ? <div className="login-error">{error}</div> : null}
          {message ? <div className="login-message-box">{message}</div> : null}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Проверяем…" : "Войти в портал"}<span>→</span></button>
          <div className="login-help"><span>Нет доступа?</span><button type="button" onClick={requestReset}>Запросить сброс пароля</button></div>
          <div className="login-footer">LOGIPAY Security · Доступ только для сотрудников</div>
        </form>
      </section>
    </main>
  );
}
