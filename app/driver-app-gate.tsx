"use client";

import { useEffect, useState } from "react";
import { driverLanguages, type DriverLocale } from "./driver-i18n";

const copy: Record<DriverLocale, Record<string, string>> = {
  de: {
    title: "Bitte die LOGIPAY-App installieren",
    text: "Touren, Belege und Nachrichten funktionieren für Fahrer nur in der installierten App – auch ohne Netz und mit Push-Nachrichten.",
    install: "App installieren",
    androidTitle: "Android",
    android: "Auf „App installieren“ tippen. Falls kein Knopf erscheint: Menü ⋮ oben rechts → „App installieren“ oder „Zum Startbildschirm hinzufügen“.",
    iosTitle: "iPhone / iPad",
    ios: "Diese Seite in Safari öffnen → unten auf Teilen □↑ tippen → „Zum Home-Bildschirm“ → „Hinzufügen“.",
    after: "Danach LOGIPAY über das neue Symbol auf dem Startbildschirm öffnen und anmelden.",
    installed: "Installiert! Jetzt LOGIPAY über das Symbol auf dem Startbildschirm öffnen.",
    logout: "Abmelden",
  },
  pl: {
    title: "Zainstaluj aplikację LOGIPAY",
    text: "Trasy, paragony i wiadomości działają dla kierowców tylko w zainstalowanej aplikacji – także bez internetu i z powiadomieniami.",
    install: "Zainstaluj aplikację",
    androidTitle: "Android",
    android: "Stuknij „Zainstaluj aplikację”. Jeśli nie ma przycisku: menu ⋮ w prawym górnym rogu → „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.",
    iosTitle: "iPhone / iPad",
    ios: "Otwórz tę stronę w Safari → stuknij Udostępnij □↑ na dole → „Do ekranu początkowego” → „Dodaj”.",
    after: "Potem otwórz LOGIPAY nową ikoną na ekranie głównym i zaloguj się.",
    installed: "Zainstalowano! Otwórz teraz LOGIPAY ikoną na ekranie głównym.",
    logout: "Wyloguj",
  },
  uk: {
    title: "Встановіть застосунок LOGIPAY",
    text: "Рейси, чеки та повідомлення працюють для водіїв лише у встановленому застосунку – навіть без інтернету та з push-сповіщеннями.",
    install: "Встановити застосунок",
    androidTitle: "Android",
    android: "Натисніть «Встановити застосунок». Якщо кнопки немає: меню ⋮ угорі праворуч → «Встановити застосунок» або «Додати на головний екран».",
    iosTitle: "iPhone / iPad",
    ios: "Відкрийте цю сторінку в Safari → унизу натисніть «Поділитися» □↑ → «На початковий екран» → «Додати».",
    after: "Потім відкрийте LOGIPAY новою іконкою на головному екрані та увійдіть.",
    installed: "Встановлено! Тепер відкрийте LOGIPAY іконкою на головному екрані.",
    logout: "Вийти",
  },
  ru: {
    title: "Установите приложение LOGIPAY",
    text: "Рейсы, чеки и сообщения работают для водителей только в установленном приложении – даже без интернета и с push-уведомлениями.",
    install: "Установить приложение",
    androidTitle: "Android",
    android: "Нажмите «Установить приложение». Если кнопки нет: меню ⋮ вверху справа → «Установить приложение» или «Добавить на главный экран».",
    iosTitle: "iPhone / iPad",
    ios: "Откройте эту страницу в Safari → внизу нажмите «Поделиться» □↑ → «На экран „Домой“» → «Добавить».",
    after: "Затем откройте LOGIPAY новой иконкой на главном экране и войдите.",
    installed: "Установлено! Теперь откройте LOGIPAY иконкой на главном экране.",
    logout: "Выйти",
  },
};

export function DriverAppGate({ locale, setLocale, logout }: { locale: DriverLocale; setLocale: (locale: DriverLocale) => void; logout: () => void }) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const c = copy[locale];

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent)));
    const update = () => setCanPrompt(Boolean(window.logipayInstallPrompt));
    const done = () => setInstalled(true);
    update();
    window.addEventListener("logipay-installable", update);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("logipay-installable", update);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  async function install() {
    const prompt = window.logipayInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
    window.logipayInstallPrompt = null;
    setCanPrompt(false);
  }

  return (
    <main className="app-gate" lang={locale}>
      <div className="app-gate-languages" role="group">
        {driverLanguages.map((item) => <button key={item.code} type="button" className={item.code === locale ? "active" : ""} onClick={() => setLocale(item.code)}>{item.short}</button>)}
      </div>
      <img src="/icon-192.png" alt="" width={88} height={88} className="app-gate-icon" />
      <h1>{c.title}</h1>
      <p>{c.text}</p>
      {installed ? <div className="app-gate-done">{c.installed}</div> : null}
      {!installed && canPrompt ? <button type="button" className="site-button" onClick={() => void install()}>{c.install}</button> : null}
      {!installed ? <div className="app-gate-steps">
        {ios ? null : <section><h2>{c.androidTitle}</h2><p>{c.android}</p></section>}
        <section><h2>{c.iosTitle}</h2><p>{c.ios}</p></section>
        {ios ? <section><h2>{c.androidTitle}</h2><p>{c.android}</p></section> : null}
        <p className="app-gate-after">{c.after}</p>
      </div> : null}
      <button type="button" className="app-gate-logout" onClick={logout}>{c.logout}</button>
    </main>
  );
}
