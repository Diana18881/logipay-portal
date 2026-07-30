"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? await response.json() as { error?: string }
      : { error: "Сервер входа временно недоступен. Попробуйте ещё раз." };
    if (!response.ok) {
      setError(result.error ?? "Не удалось войти");
      setLoading(false);
      return;
    }
    window.location.href = "/";
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
          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Проверяем…" : "Войти в портал"}<span>→</span></button>
          <div className="login-help"><span>Нет доступа?</span><button type="button">Обратитесь к администратору</button></div>
          <div className="login-footer">LOGIPAY Security · Доступ только для сотрудников</div>
        </form>
      </section>
    </main>
  );
}
