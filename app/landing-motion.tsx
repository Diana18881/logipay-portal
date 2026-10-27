"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Fades sections in as they scroll into view. Without JavaScript or with reduced motion everything stays visible. */
export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("lp-motion");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root.classList.remove("lp-motion");
    };
  }, []);
  return null;
}

export function PriceCalculator({ priceCents }: { priceCents: number }) {
  const [drivers, setDrivers] = useState(15);
  const monthly = (drivers * priceCents) / 100;
  const euro = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: value % 1 ? 2 : 0 });
  return (
    <div className="lp-calc">
      <label htmlFor="lp-drivers">Wie viele Fahrer haben Sie?</label>
      <div className="lp-calc-count"><b>{drivers}</b><span>Fahrer</span></div>
      <input id="lp-drivers" type="range" min={1} max={150} value={drivers} onChange={(event) => setDrivers(Number(event.target.value))} style={{ ["--fill" as string]: `${((drivers - 1) / 149) * 100}%` }} />
      <div className="lp-calc-total"><span>Pro Monat</span><b key={drivers}>{euro(monthly)}</b><small>zzgl. MwSt. · {euro(priceCents / 100)} je Fahrer</small></div>
      <Link href="/registrieren" className="site-button lp-cta">Kostenlos testen <span aria-hidden="true">→</span></Link>
    </div>
  );
}
