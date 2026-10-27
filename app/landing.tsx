import Link from "next/link";
import { pricePerDriverCents } from "../lib/billing";
import { TRIAL_DAYS } from "../lib/tenants";
import { LandingMotion, PriceCalculator } from "./landing-motion";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { Truck3D } from "./truck-3d";
import { TruckScene } from "./truck-scene";

const steps = [
  { title: "Firma anlegen", text: "In einer Minute registriert. Ihre Firma bekommt eine eigene, getrennte Datenbank." },
  { title: "Fahrer einladen", text: "Fahrer installieren die App direkt aus dem Browser – auf Android und iPhone." },
  { title: "Monat abschließen", text: "Touren, Belege und Zuschläge fließen in die Lohnwerte. Ein Klick erzeugt den DATEV-Export." },
];

const features = [
  { icon: "€", title: "Lohn & DATEV", text: "Grundlohn, Zuschläge, Spesen und Abzüge pro Monat – als LODAS-Datei für Ihr Steuerbüro." },
  { icon: "▦", title: "Wochenplanung", text: "Fahrer, Fahrzeuge und Aufträge pro Kalenderwoche planen und live verfolgen." },
  { icon: "◫", title: "Belege per Foto", text: "Fahrer fotografieren Tank- und Spesenbelege, die Buchhaltung prüft und erstattet." },
  { icon: "◷", title: "Fristen im Blick", text: "Führerschein, Fahrerkarte, Code 95, ADR und TÜV – das Portal erinnert rechtzeitig." },
  { icon: "⌖", title: "GPS & Lenkzeiten", text: "Positionen und Fahrzeiten aus Telematik-Systemen, mit Warnung vor Überschreitung." },
  { icon: "✉", title: "Chat & Sprachnachrichten", text: "Direkt zwischen Disposition und Fahrer – oder pro Tour." },
];

const faqs = [
  { q: "Was zählt als aktiver Fahrer?", a: "Jede Person, die im Portal als aktiver Mitarbeiter geführt wird. Archivierte Mitarbeiter kosten nichts. Büro-Zugänge für Geschäftsleitung, Buchhaltung und Disposition sind inklusive." },
  { q: "Ersetzt LOGIPAY mein Lohnprogramm?", a: "Nein. LOGIPAY sammelt alle Lohndaten aus dem Betriebsalltag und übergibt sie per DATEV-Export an Ihr Steuerbüro. Die Entgeltabrechnung mit Steuern und Sozialversicherung bleibt dort." },
  { q: "Wo liegen meine Daten?", a: "Ausschließlich in der EU: Anwendung und Dateien in Frankfurt am Main, Datenbanken in Irland. Jede Firma hat eine eigene Datenbank. Der Vertrag zur Auftragsverarbeitung (AVV) ist inklusive." },
  { q: "Brauchen Fahrer den App Store?", a: "Nein. Die Fahrer-App wird direkt aus dem Browser installiert, funktioniert auch ohne Netz und spricht Deutsch, Polnisch, Ukrainisch und Russisch." },
  { q: "Wie kündige ich?", a: "Monatlich, mit einem Klick. Vorher können Sie alle Daten exportieren, danach werden sie vollständig gelöscht." },
];

const marquee = ["DATEV-Export", "Fahrer-App", "Belege per Foto", "Wochenplanung", "GPS-Tracking", "Lenkzeiten", "Urlaub & Krankheit", "Dokumente & Fristen", "Chat & Sprachnachrichten", "Offline-Modus", "4 Sprachen", "DSGVO-konform"];

const trust = [
  ["EU", "Server in der EU", "Frankfurt und Irland"],
  ["▣", "Eigene Datenbank", "Pro Firma getrennt"],
  ["2FA", "Zwei-Faktor-Anmeldung", "Für Leitung und Buchhaltung"],
  ["§", "AVV inklusive", "Art. 28 DSGVO"],
];

export function Landing() {
  const priceCents = pricePerDriverCents();
  const price = (priceCents / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return (
    <div className="site lp">
      <LandingMotion />
      <SiteHeader />
      <main>
        <section className="lp-hero lp-hero-dark">
          <div className="lp-hero-scene" aria-hidden="true"><TruckScene /><Truck3D /></div>
          <div className="lp-hero-shade" aria-hidden="true" />
          <div className="lp-hero-text">
            <span className="lp-pill lp-rise">Für Transport- und Logistikfirmen</span>
            <h1 className="lp-rise lp-d1">Weniger Papier.<br /><span className="lp-gradient">Mehr Touren.</span></h1>
            <p className="lp-lead lp-rise lp-d2">Disposition, Belege, Fahrer-App und Lohnvorbereitung in einem Portal. Ihr Steuerbüro bekommt den DATEV-Export.</p>
            <div className="lp-actions lp-rise lp-d3">
              <Link href="/registrieren" className="site-button lp-cta">{TRIAL_DAYS} Tage kostenlos testen <span aria-hidden="true">→</span></Link>
              <a href="/api/auth/demo" className="site-button site-button-ghost">Demo ansehen <span aria-hidden="true">▶</span></a>
            </div>
            <p className="lp-demo-hint lp-rise lp-d4">Ohne Anmeldung: <a href="/api/auth/demo">Büro-Ansicht</a> · <a href="/api/auth/demo?as=fahrer">Fahrer-App</a></p>
            <ul className="lp-checks lp-rise lp-d4"><li>Ohne Kreditkarte</li><li>Server in der EU</li><li>Monatlich kündbar</li></ul>
          </div>

        </section>

        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">{[0, 1].map((copy) => <div key={copy}>{marquee.map((item) => <span key={`${copy}-${item}`}>{item}</span>)}</div>)}</div>
        </div>

        <section className="lp-section">
          <div className="lp-head" data-reveal><span className="lp-kicker">So einfach geht&apos;s</span><h2>In drei Schritten startklar</h2></div>
          <ol className="lp-steps">{steps.map((step, index) => <li key={step.title} data-reveal style={{ transitionDelay: `${index * 90}ms` }}><span>{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
        </section>

        <section id="funktionen" className="lp-section">
          <div className="lp-head" data-reveal><span className="lp-kicker">Funktionen</span><h2>Alles zwischen Disposition und Lohnbüro</h2></div>
          <div className="lp-features">{features.map((feature, index) => <article key={feature.title} data-reveal style={{ transitionDelay: `${(index % 3) * 80}ms` }}><span>{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section id="fahrer-app" className="lp-section">
          <div className="lp-app" data-reveal>
            <div className="lp-app-visual" aria-hidden="true">
              <div className="lp-phone">
                <div className="lp-phone-notch" />
                <div className="lp-screen">
                  <small>Heute · 06:00</small>
                  <b>Hamburg → Bremen</b>
                  <div className="lp-route"><i className="lp-route-dot" /><span className="lp-route-line"><em /></span><i className="lp-route-dot lp-route-end" /></div>
                  <div className="lp-status"><span>Beladen</span><span>Unterwegs</span><span>Zugestellt</span></div>
                  <div className="lp-screen-card"><span>Fahrzeugcheck</span><b>✓ OK</b></div>
                  <div className="lp-screen-card"><span>Lenkzeit übrig</span><b>4:20 h</b></div>
                  <div className="lp-screen-msg"><small>Disposition · 05:52</small><p>Rampe 4 ist frei – gute Fahrt!</p></div>
                  <div className="lp-screen-button">Beleg fotografieren</div>
                </div>
              </div>
              <div className="lp-toast lp-toast-1"><span>✓</span><div><b>Beleg erkannt</b><small>Diesel · 312,40 €</small></div></div>
              <div className="lp-toast lp-toast-2"><span>▦</span><div><b>Neue Tour</b><small>Morgen 05:30 · Lüneburg</small></div></div>
              <div className="lp-toast lp-toast-3"><span>€</span><div><b>DATEV-Export bereit</b><small>Oktober · 24 Fahrer</small></div></div>
            </div>
            <div className="lp-app-copy">
              <span className="lp-kicker lp-kicker-light">Fahrer-App</span>
              <h2>Einfach genug für jeden Fahrer</h2>
              <p>Große Knöpfe, klare Schritte, vier Sprachen. Installiert mit einem Fingertipp – ohne App Store.</p>
              <ul className="lp-langs"><li>Deutsch</li><li>Polski</li><li>Українська</li><li>Русский</li></ul>
              <ul className="lp-app-list">
                <li>Tour, Abfahrt und Zustellung mit Unterschrift</li>
                <li>Belege und Lieferscheine mit der Kamera</li>
                <li>Funktioniert ohne Netz, sendet später automatisch</li>
                <li>Push-Nachrichten bei neuen Touren</li>
              </ul>
              <Link href="/app" className="site-button lp-button-light">So installieren Fahrer die App</Link>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-head" data-reveal><span className="lp-kicker">Datenschutz</span><h2>Gebaut für Personaldaten</h2></div>
          <div className="lp-trust">{trust.map(([icon, title, text], index) => <div key={title} data-reveal style={{ transitionDelay: `${index * 70}ms` }}><span>{icon}</span><b>{title}</b><small>{text}</small></div>)}</div>
        </section>

        <section id="preise" className="lp-section">
          <div className="lp-head" data-reveal><span className="lp-kicker">Preis</span><h2>Ein Preis. Alle Funktionen.</h2></div>
          <div className="lp-pricing" data-reveal>
            <PriceCalculator priceCents={priceCents} />
            <ul className="lp-price-list">
              <li>{price} € pro aktivem Fahrer und Monat, zzgl. MwSt.</li>
              <li>Alle Funktionen inklusive DATEV-Export und Fahrer-App</li>
              <li>Unbegrenzte Büro-Zugänge</li>
              <li>{TRIAL_DAYS} Tage kostenlos, ohne Kreditkarte</li>
              <li>Monatlich kündbar</li>
            </ul>
          </div>
        </section>

        <section className="lp-section lp-section-narrow">
          <div className="lp-head" data-reveal><span className="lp-kicker">Fragen</span><h2>Gut zu wissen</h2></div>
          <div className="lp-faq">{faqs.map((faq) => <details key={faq.q} data-reveal><summary>{faq.q}<span aria-hidden="true">+</span></summary><p>{faq.a}</p></details>)}</div>
        </section>

        <section className="lp-final" data-reveal>
          <h2>Bereit für weniger Papierkram?</h2>
          <p>{TRIAL_DAYS} Tage kostenlos. Keine Kreditkarte. In einer Minute eingerichtet.</p>
          <div className="lp-final-actions"><Link href="/registrieren" className="site-button lp-cta">Jetzt kostenlos starten <span aria-hidden="true">→</span></Link><a href="/api/auth/demo" className="site-button site-button-ghost">Demo ansehen</a></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
