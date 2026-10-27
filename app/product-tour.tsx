"use client";

import { useEffect, useState } from "react";

// Real screens from the demo company, rotating like a short product video.
const slides = [
  { id: "overview", tab: "Übersicht", title: "Alles auf einen Blick", text: "Fahrer, Touren, offene Belege und ablaufende Dokumente – mit Grafiken statt Tabellen.", image: "/tour/overview.webp" },
  { id: "payroll", tab: "Monatsabschluss", title: "Lohn ohne Rätselraten", text: "Zuschläge und Spesen nach deutschen Regeln – jede Zahl mit Erklärung, dann per Klick zum Steuerbüro.", image: "/tour/payroll.webp" },
  { id: "tours", tab: "Touren", title: "Jede Tour im Griff", text: "Von – nach, Status, ETA und Tour-Chat mit dem Fahrer in einer Karte.", image: "/tour/tours.webp" },
  { id: "driver", tab: "Fahrer-App", title: "Die App für Fahrer", text: "Abfahrt bestätigen, Belege fotografieren, Chat – in vier Sprachen, auch ohne Netz.", image: "/tour/driver.webp", phone: true },
];
const DURATION = 6000;

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % slides.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [active, paused]);
  const slide = slides[active];
  return (
    <section className="lp-section tour" id="produkt" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="lp-head" data-reveal><span className="lp-kicker">Produkt</span><h2>So sieht LOGIPAY aus</h2></div>
      <div className="tour-tabs" role="tablist">
        {slides.map((item, index) => (
          <button key={item.id} type="button" role="tab" aria-selected={index === active} className={index === active ? "active" : ""} onClick={() => setActive(index)}>
            {item.tab}
            <i style={{ animationDuration: `${DURATION}ms`, animationPlayState: paused ? "paused" : "running" }} key={`${item.id}-${active}`} />
          </button>
        ))}
      </div>
      <div data-reveal><div className={`tour-stage ${slide.phone ? "phone-mode" : ""}`}>
        <div className={`tour-browser ${slide.phone ? "is-hidden" : ""}`} aria-hidden={slide.phone ? "true" : "false"}>
          <div className="tour-bar"><span /><span /><span /><em>logipay · Muster Transporte</em></div>
          <div className="tour-screens">
            {slides.filter((item) => !item.phone).map((item) => <img key={item.id} src={item.image} alt={item.title} loading="lazy" className={item.id === slide.id ? "active" : ""} />)}
          </div>
        </div>
        <div className={`tour-phone ${slide.phone ? "is-active" : ""}`}>
          <img src="/tour/driver.webp" alt="LOGIPAY Fahrer-App" loading="lazy" />
        </div>
        <div className="tour-caption" key={slide.id}><b>{slide.title}</b><p>{slide.text}</p></div>
      </div></div>
    </section>
  );
}
