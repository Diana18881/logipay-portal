import Link from "next/link";
import { pricePerDriverCents } from "../lib/billing";
import { contactEmail } from "../lib/legal";
import { TRIAL_DAYS } from "../lib/tenants";
import { SiteFooter, SiteHeader } from "./site-chrome";

const features = [
  { icon: "€", title: "Lohn & DATEV-Export", text: "Grundlohn, Touren, Nacht-, Sonn- und Feiertagszuschläge, Spesen und Abzüge pro Monat berechnen. Export im DATEV-LODAS-Format für Ihr Steuerbüro." },
  { icon: "▦", title: "Wochenplanung & Touren", text: "Fahrer, Fahrzeuge und Aufträge pro Kalenderwoche planen. Status von Beladung bis Zustellung live verfolgen." },
  { icon: "▤", title: "Belege & Auslagen", text: "Fahrer fotografieren Tank- und Spesenbelege. Beträge werden erkannt, die Buchhaltung prüft und erstattet." },
  { icon: "◷", title: "Dokumente & Fristen", text: "Führerschein, Fahrerkarte, Code 95, ADR und TÜV mit Ablaufdatum. Das Portal erinnert rechtzeitig." },
  { icon: "⌖", title: "Live-Tracking & Tachograph", text: "GPS-Positionen und Lenkzeiten aus Telematik-Systemen. Warnung, bevor die Fahrzeit überschritten wird." },
  { icon: "✉", title: "Chat & Sprachnachrichten", text: "Nachrichten, Fotos und Sprachnachrichten zwischen Disposition und Fahrern – direkt oder pro Tour." },
];

const faqs = [
  { q: "Was zählt als aktiver Fahrer?", a: "Jede Person, die im Portal als aktiver Mitarbeiter geführt wird. Archivierte Mitarbeiter kosten nichts. Büro-Zugänge für Geschäftsleitung, Buchhaltung und Disposition sind inklusive." },
  { q: "Ersetzt LOGIPAY mein Lohnprogramm?", a: "Nein. LOGIPAY sammelt alle Lohndaten aus dem Betriebsalltag und übergibt sie per DATEV-Export an Ihr Steuerbüro oder Lohnprogramm. Die Entgeltabrechnung mit Steuern und Sozialversicherung bleibt dort." },
  { q: "Wo liegen meine Daten?", a: "Auf Servern in der EU (Frankfurt am Main). Jede Firma hat eine eigene, getrennte Datenbank. Einen Vertrag zur Auftragsverarbeitung (AVV) nach Art. 28 DSGVO schließen Sie bei der Registrierung ab." },
  { q: "Brauchen Fahrer eine App aus dem App Store?", a: "Nein. Die Fahrer-App wird direkt aus dem Browser auf dem Handy installiert, funktioniert auf Android und iPhone, auch offline, und spricht Deutsch, Polnisch, Ukrainisch und Russisch." },
  { q: "Wie kündige ich?", a: "Monatlich, mit einem Klick im Kundenportal. Vorher können Sie alle Daten als Datei exportieren. Danach werden Ihre Daten vollständig gelöscht." },
];

export function Landing() {
  const price = (pricePerDriverCents() / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const email = contactEmail();
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">FÜR TRANSPORT- UND LOGISTIKUNTERNEHMEN</p>
            <h1>Lohn, Touren und Fahrer – <em>in einem Portal.</em></h1>
            <p className="hero-lead">LOGIPAY verbindet Disposition, Belege, Dokumente und Lohnvorbereitung. Ihre Fahrer arbeiten mit der Fahrer-App auf dem Handy, Ihr Steuerbüro bekommt den DATEV-Export.</p>
            <div className="hero-actions">
              <Link href="/registrieren" className="site-button">{TRIAL_DAYS} Tage kostenlos testen</Link>
              {email ? <a href={`mailto:${email}?subject=${encodeURIComponent("LOGIPAY Live-Demo")}`} className="site-button site-button-ghost">Live-Demo anfragen</a> : <Link href="#preise" className="site-button site-button-ghost">Preise ansehen</Link>}
            </div>
            <ul className="hero-points"><li>Keine Kreditkarte für den Test</li><li>Server in Deutschland</li><li>Monatlich kündbar</li></ul>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="mock-window">
              <div className="mock-bar"><span /><span /><span /></div>
              <div className="mock-kpis"><div><small>Fahrer aktiv</small><b>24</b></div><div><small>Touren heute</small><b>31</b></div><div><small>Offene Belege</small><b>7</b></div></div>
              <div className="mock-rows">{["Unterwegs · HH-MT 101", "Beladen · HB-MT 201", "Zugestellt · H-MT 301", "Geplant · HH-MT 103"].map((row) => <div key={row}><i />{row}</div>)}</div>
            </div>
            <div className="mock-phone"><div className="mock-phone-screen"><small>Meine Tour</small><b>Hamburg → Bremen</b><span>Abfahrt 06:00</span><button type="button" tabIndex={-1}>Abfahrt bestätigen</button><button type="button" tabIndex={-1} className="ghost">Beleg fotografieren</button></div></div>
          </div>
        </section>

        <section id="funktionen" className="site-section">
          <p className="eyebrow">FUNKTIONEN</p>
          <h2>Alles, was zwischen Disposition und Lohnbüro passiert</h2>
          <div className="feature-grid">{features.map((feature) => <article key={feature.title}><span>{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section id="fahrer-app" className="site-section app-section">
          <div>
            <p className="eyebrow">FAHRER-APP</p>
            <h2>Die App für Ihre Fahrer – ohne App Store</h2>
            <ul className="check-list">
              <li>Installation mit einem Fingertipp auf Android und iPhone</li>
              <li>Tour, Abfahrt, Fahrzeugcheck und Zustellung mit Unterschrift</li>
              <li>Belege und Tankquittungen mit der Kamera erfassen</li>
              <li>Funktioniert ohne Netz – sendet automatisch, sobald Empfang da ist</li>
              <li>Push-Nachrichten bei neuen Touren und Nachrichten</li>
              <li>Deutsch, Polnisch, Ukrainisch und Russisch</li>
            </ul>
            <Link href="/app" className="site-button site-button-ghost">So installieren Fahrer die App</Link>
          </div>
        </section>

        <section className="site-section trust-section">
          <p className="eyebrow">DATENSCHUTZ & SICHERHEIT</p>
          <h2>Gebaut für Personaldaten</h2>
          <div className="trust-grid">
            <div><b>EU-Server</b><span>Hosting und Datenbank in Frankfurt am Main</span></div>
            <div><b>Getrennte Datenbank</b><span>Jede Firma hat ihre eigene Datenbank und eigenen Dateispeicher</span></div>
            <div><b>Zwei-Faktor-Anmeldung</b><span>Pflicht für Geschäftsleitung und Buchhaltung</span></div>
            <div><b>Änderungsprotokoll</b><span>Jede Änderung und jeder Dokumentenzugriff wird protokolliert</span></div>
            <div><b>AVV nach Art. 28 DSGVO</b><span>Vertrag zur Auftragsverarbeitung inklusive</span></div>
            <div><b>Export & Löschung</b><span>Alle Daten jederzeit exportieren oder endgültig löschen</span></div>
          </div>
        </section>

        <section id="preise" className="site-section pricing-section">
          <p className="eyebrow">PREISE</p>
          <h2>Ein Preis. Alle Funktionen.</h2>
          <div className="price-card">
            <div className="price"><b>{price} €</b><span>pro aktivem Fahrer / Monat<br />zzgl. MwSt.</span></div>
            <ul className="check-list">
              <li>Alle Funktionen inklusive DATEV-Export und Fahrer-App</li>
              <li>Unbegrenzte Büro-Zugänge</li>
              <li>{TRIAL_DAYS} Tage kostenlos, ohne Kreditkarte</li>
              <li>Monatlich kündbar, sichere Zahlung über Stripe</li>
            </ul>
            <Link href="/registrieren" className="site-button">Jetzt kostenlos starten</Link>
          </div>
        </section>

        <section className="site-section faq-section">
          <p className="eyebrow">FRAGEN</p>
          <h2>Häufige Fragen</h2>
          <div className="faq-list">{faqs.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
