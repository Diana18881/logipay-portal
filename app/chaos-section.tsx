"use client";

import { useEffect, useRef, useState } from "react";
import { AppMovie } from "./app-movie";

// Scroll story for the landing page: the daily chaos of spreadsheets, chats and paper
// gets pulled into one LOGIPAY app. Scroll progress drives a CSS variable (--p from 0 to 1).

type Item = { kind: "xlsx" | "pdf" | "chat" | "note" | "csv" | "paper"; title: string; meta: string; x: number; y: number; r: number };

const items: Item[] = [
  { kind: "xlsx", title: "Lohn_Oktober_final_v3.xlsx", meta: "Excel · 14 Blätter", x: -42, y: -30, r: -12 },
  { kind: "xlsx", title: "Fahrerliste_NEU.xlsx", meta: "Excel · zuletzt geändert von ?", x: 34, y: -36, r: 9 },
  { kind: "chat", title: "WhatsApp · Disposition", meta: "„Wer fährt morgen nach Bremen??“", x: 40, y: 4, r: -6 },
  { kind: "pdf", title: "Tankbelege_Sept.pdf", meta: "PDF · 63 Seiten Fotos", x: -38, y: 12, r: 7 },
  { kind: "xlsx", title: "Touren KW44 (2).xlsx", meta: "Excel · Kopie von Kopie", x: -10, y: -42, r: 4 },
  { kind: "note", title: "Führerschein Marek läuft ab!", meta: "Zettel am Monitor", x: 22, y: 34, r: -9 },
  { kind: "chat", title: "WhatsApp · Fahrer Polen", meta: "📷 Foto Lieferschein", x: -24, y: 38, r: 11 },
  { kind: "csv", title: "DATEV_Import_alt.csv", meta: "Steuerbüro · Fehler Zeile 41", x: 6, y: 40, r: -3 },
  { kind: "xlsx", title: "Urlaubsplan_2026.xlsx", meta: "Excel · 3 Versionen", x: 44, y: -12, r: 14 },
  { kind: "paper", title: "Quittung Parkhaus", meta: "zerknittert · 18,50 €", x: -46, y: -6, r: -15 },
  { kind: "note", title: "Spesen ausrechnen!!", meta: "Post-it", x: 12, y: -24, r: 8 },
  { kind: "xlsx", title: "Spesen_Berechnung.xlsx", meta: "Excel · Formel kaputt", x: -16, y: 18, r: -8 },
];

const icon: Record<Item["kind"], string> = { xlsx: "X", pdf: "PDF", chat: "✆", note: "!", csv: "CSV", paper: "€" };

export function ChaosSection() {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      section.style.setProperty("--p", "1");
      const still = requestAnimationFrame(() => setPlaying(true));
      return () => cancelAnimationFrame(still);
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      section.style.setProperty("--p", progress.toFixed(3));
      // The app "video" plays once the files have landed and while the section is on screen.
      setPlaying(progress > 0.55 && rect.bottom > 0 && rect.top < window.innerHeight);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section ref={ref} className="chaos" aria-label="Von Excel-Chaos zu einer App">
      <div className="chaos-sticky">
        <div className="chaos-copy">
          <p className="chaos-before"><span className="lp-kicker">So sieht es heute aus</span><b>Excel-Tabellen, WhatsApp-Gruppen, Zettel und ein Schuhkarton voller Belege.</b></p>
          <p className="chaos-after"><span className="lp-kicker">Mit LOGIPAY</span><b>Alles in einer App – für Büro und Fahrer.</b></p>
        </div>
        <div className="chaos-stage" aria-hidden="true">
          {items.map((item, index) => (
            <div key={item.title} className={`chaos-item chaos-${item.kind}`} style={{ ["--x" as string]: item.x, ["--y" as string]: item.y, ["--r" as string]: `${item.r}deg`, ["--d" as string]: index }}>
              <span>{icon[item.kind]}</span>
              <div><b>{item.title}</b><small>{item.meta}</small></div>
            </div>
          ))}
          <div className="chaos-app">
            <div className="chaos-app-glow" />
            <div className="chaos-app-window">
              <header><i /><i /><i /><b>LOGIPAY</b></header>
              <AppMovie playing={playing} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
