import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { InstallButton } from "./install-button";

export const metadata: Metadata = {
  title: "LOGIPAY Fahrer-App installieren",
  description: "Die LOGIPAY Fahrer-App auf Android oder iPhone installieren – ohne App Store.",
};

export default function InstallPage() {
  return (
    <div className="site">
      <SiteHeader cta={false} />
      <main className="install-page">
        <p className="eyebrow">FAHRER-APP</p>
        <h1>LOGIPAY auf dem Handy installieren</h1>
        <p>Die App kommt direkt von dieser Seite, ohne App Store. Danach starten Sie LOGIPAY wie jede andere App vom Startbildschirm – auch ohne Netz.</p>
        <InstallButton />
        <div className="install-steps">
          <section>
            <h2>Android (Chrome)</h2>
            <ol>
              <li>Diese Seite in Chrome öffnen.</li>
              <li>Auf „App installieren“ tippen – oder im Menü ⋮ „App installieren“ wählen.</li>
              <li>Mit Ihren Zugangsdaten von der Firma anmelden.</li>
            </ol>
          </section>
          <section>
            <h2>iPhone (Safari)</h2>
            <ol>
              <li>Diese Seite in Safari öffnen.</li>
              <li>Unten auf das Teilen-Symbol <b>□↑</b> tippen.</li>
              <li>„Zum Home-Bildschirm“ wählen und „Hinzufügen“ tippen.</li>
              <li>LOGIPAY vom Home-Bildschirm starten und anmelden. Für Push-Nachrichten ist iOS 16.4 oder neuer nötig.</li>
            </ol>
          </section>
          <section>
            <h2>Nach dem Start</h2>
            <ol>
              <li>Benachrichtigungen erlauben, damit neue Touren und Nachrichten sofort ankommen.</li>
              <li>Kamera erlauben, um Belege und Lieferscheine zu fotografieren.</li>
              <li>Sprache oben rechts wählen: Deutsch, Polski, Українська oder Русский.</li>
            </ol>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
