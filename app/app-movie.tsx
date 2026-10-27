"use client";

import { useEffect, useState } from "react";

// A scripted "screen recording" of LOGIPAY, played inside the app window of the scroll story:
// register → import drivers → see everything → send payroll to the tax office. Loops while visible.

const LOOP = 17000;
const scenes = [
  { from: 0, to: 4600, label: "Registrieren" },
  { from: 4600, to: 8200, label: "Fahrer importieren" },
  { from: 8200, to: 12000, label: "Alles im Blick" },
  { from: 12000, to: 16400, label: "Lohn an Steuerbüro" },
];

const typed = (text: string, t: number, start: number, end: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.round(((t - start) / (end - start)) * text.length))));
const between = (t: number, start: number, end: number) => Math.max(0, Math.min(1, (t - start) / (end - start)));
const euro = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";

const drivers = [["Marek Nowak", "Fernverkehr", "3.612 €"], ["Andrei Popescu", "Nahverkehr", "3.470 €"], ["Lukas Hoffmann", "Nahverkehr", "3.620 €"]];

export function AppMovie({ playing }: { playing: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const still = requestAnimationFrame(() => setT(10500));
      return () => cancelAnimationFrame(still);
    }
    let start = performance.now() - t;
    let frame = 0;
    const tick = (now: number) => {
      let elapsed = now - start;
      if (elapsed > LOOP) { start = now; elapsed = 0; }
      setT(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // t is only the resume point; restarting on every frame is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const scene = Math.max(0, scenes.findIndex((item) => t >= item.from && t < item.to));
  const fading = t > 16400;
  // cursor target per moment (percent of the screen)
  const cursor = t < 3700 ? { x: 70, y: 86, on: t > 3300 } : t < 4600 ? { x: 50, y: 82, on: t > 3800 && t < 4000 } : t < 8200 ? { x: 62, y: 30, on: t > 4700 && t < 4900 } : t < 12000 ? { x: 80, y: 18, on: false } : { x: 76, y: 88, on: t > 14400 && t < 14700 };

  return (
    <div className={`movie ${fading ? "movie-fade" : ""}`}>
      <div className="movie-screen">
        {/* 1 · register */}
        <section className={`movie-scene ${scene === 0 ? "active" : ""}`}>
          <h4>Firma registrieren</h4>
          <label>Firmenname<span>{typed("Muster Transporte GmbH", t, 300, 1500)}<i className={t < 1500 ? "caret" : ""} /></span></label>
          <label>E-Mail<span>{typed("anna@muster-transporte.de", t, 1600, 2700)}<i className={t >= 1500 && t < 2700 ? "caret" : ""} /></span></label>
          <label>Passwort<span>{"•".repeat(Math.round(between(t, 2800, 3300) * 12))}<i className={t >= 2700 && t < 3300 ? "caret" : ""} /></span></label>
          <div className="movie-check"><b className={t > 3500 ? "on" : ""}>{t > 3500 ? "✓" : ""}</b>AGB und AVV akzeptiert</div>
          <button type="button" tabIndex={-1} className={t > 3850 && t < 4050 ? "pressed" : ""}>{t > 4050 ? "Portal wird eingerichtet …" : "Kostenlos starten →"}</button>
        </section>

        {/* 2 · import */}
        <section className={`movie-scene ${scene === 1 ? "active" : ""}`}>
          <h4>Fahrer aus Excel übernehmen</h4>
          <div className={`movie-file ${t > 4800 ? "in" : ""}`}><span>X</span><div><b>Fahrerliste.xlsx</b><small>8 Zeilen erkannt</small></div></div>
          <div className="movie-progress"><i style={{ width: `${between(t, 5000, 6000) * 100}%` }} /></div>
          <ul className="movie-rows">
            {drivers.map(([name, kind], index) => <li key={name} className={t > 6100 + index * 300 ? "in" : ""}><em>✓</em><b>{name}</b><small>{kind}</small></li>)}
          </ul>
          <div className={`movie-toast ${t > 7300 ? "in" : ""}`}>✓ 8 Fahrer importiert</div>
        </section>

        {/* 3 · overview */}
        <section className={`movie-scene ${scene === 2 ? "active" : ""}`}>
          <h4>Guten Tag, Anna</h4>
          <div className="movie-kpis">
            <div><small>Fahrer</small><b>{Math.round(between(t, 8300, 9300) * 8)}</b></div>
            <div><small>Touren</small><b>{Math.round(between(t, 8300, 9500) * 24)}</b></div>
            <div><small>Belege</small><b>{Math.round(between(t, 8300, 9100) * 3)}</b></div>
          </div>
          <div className="movie-bars">{[48, 72, 60, 88, 66, 30, 18].map((height, index) => <i key={index} style={{ height: `${height * between(t, 8700 + index * 90, 9700 + index * 90)}%` }} />)}</div>
          <div className={`movie-toast movie-toast-warn ${t > 10300 ? "in" : ""}`}>Fahrerkarte Marek läuft in 18 Tagen ab</div>
        </section>

        {/* 4 · payroll */}
        <section className={`movie-scene ${scene === 3 ? "active" : ""}`}>
          <h4>Monatsabschluss Oktober</h4>
          <ul className="movie-pay">
            {drivers.map(([name, , amount], index) => <li key={name} className={t > 12200 + index * 350 ? "in" : ""}><b>{name}</b><span>{amount}</span></li>)}
            <li className={`movie-more ${t > 13250 ? "in" : ""}`}><b>… und 5 weitere Fahrer</b></li>
          </ul>
          <div className="movie-total"><small>Gesamt vor Steuern</small><b>{euro(Math.round(between(t, 13300, 14200) * 28318))}</b></div>
          <button type="button" tabIndex={-1} className={t > 14450 && t < 14650 ? "pressed" : ""}>{t > 14650 ? "✓ DATEV-Datei erstellt" : "An Steuerbüro (DATEV)"}</button>
        </section>

        <div className={`movie-cursor ${cursor.on ? "click" : ""}`} style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} />
      </div>
      <ol className="movie-steps">{scenes.map((item, index) => <li key={item.label} className={index === scene ? "active" : index < scene ? "done" : ""}><b>{index + 1}</b>{item.label}</li>)}</ol>
    </div>
  );
}
