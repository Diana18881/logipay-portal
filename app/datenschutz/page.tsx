import type { Metadata } from "next";
import { sellerDetails } from "../../lib/legal";
import { DraftNotice, SellerAddress, subprocessors } from "../legal-parts";
import { LegalPage } from "../site-chrome";

export const metadata: Metadata = { title: "Datenschutz — LOGIPAY" };
export const dynamic = "force-dynamic";

export default function DatenschutzPage() {
  const seller = sellerDetails();
  return (
    <LegalPage title="Datenschutzhinweise">
      <DraftNotice />
      <h2>1. Verantwortlicher</h2>
      <p>Verantwortlich für diese Website und für die Daten unserer Kunden als Vertragspartner ist:</p>
      <SellerAddress />
      <p>E-Mail: {seller.email}</p>
      <h2>2. Zwei Rollen: Website und Portal</h2>
      <p>Für den Besuch dieser Website und für die Vertragsdaten unserer Kunden (Firmenname, Ansprechpartner, Rechnungsdaten) sind wir Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO.</p>
      <p>Die Daten, die Kunden im Portal über ihre Beschäftigten speichern (z. B. Fahrer, Touren, Lohndaten, Dokumente, GPS-Positionen), verarbeiten wir ausschließlich im Auftrag und nach Weisung des jeweiligen Kunden (Art. 28 DSGVO). Verantwortlicher ist dann der Kunde als Arbeitgeber. Betroffene wenden sich mit Anfragen bitte an ihren Arbeitgeber. Die Einzelheiten regelt der <a href="/avv">Vertrag zur Auftragsverarbeitung</a>.</p>
      <h2>3. Daten beim Besuch der Website</h2>
      <p>Beim Aufruf der Website verarbeitet unser Hosting-Dienstleister technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browsertyp) zur Auslieferung und zur Abwehr von Angriffen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Die Protokolle werden nach kurzer Zeit gelöscht.</p>
      <h2>4. Cookies</h2>
      <p>Wir verwenden ausschließlich ein technisch notwendiges Cookie für die Anmeldung im Portal (Sitzungs-Cookie, Laufzeit 7 Tage). Es gibt keine Analyse-, Werbe- oder Tracking-Cookies. Eine Einwilligung ist daher nicht erforderlich (§ 25 Abs. 2 TDDDG).</p>
      <h2>5. Registrierung und Vertrag</h2>
      <p>Bei der Registrierung speichern wir Firmenname, Name und E-Mail-Adresse des Ansprechpartners sowie ein verschlüsseltes Passwort. Zum Schutz vor Missbrauch speichern wir die IP-Adresse der Registrierung für eine Stunde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
      <h2>6. Zahlungen</h2>
      <p>Abonnements werden über Stripe abgewickelt. Zahlungsdaten gibt der Kunde direkt bei Stripe ein; wir erhalten nur den Status der Zahlung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Rechnungsdaten bewahren wir gemäß § 147 AO und § 257 HGB bis zu zehn Jahre auf.</p>
      <h2>7. Empfänger und Speicherort</h2>
      <p>Wir setzen folgende Dienstleister ein, mit denen Verträge zur Auftragsverarbeitung bestehen:</p>
      <ul>{subprocessors.map(([name, purpose]) => <li key={name}><b>{name}</b> – {purpose}</li>)}</ul>
      <p>Push-Benachrichtigungen werden über den Push-Dienst des jeweiligen Browsers bzw. Betriebssystems (z. B. Google, Apple, Mozilla) zugestellt; übertragen wird nur der kurze Benachrichtigungstext.</p>
      <h2>8. Speicherdauer</h2>
      <p>Wir speichern Daten, solange das Kundenkonto besteht. Löscht ein Kunde seine Firma, werden Datenbank, Dateien und Zugänge sofort gelöscht; gesetzliche Aufbewahrungspflichten für Rechnungen bleiben unberührt.</p>
      <h2>9. Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.</p>
      <h2>10. Sicherheit</h2>
      <p>Die Übertragung erfolgt verschlüsselt (TLS). Jede Kundenfirma hat eine eigene Datenbank und einen getrennten Dateispeicher. Passwörter werden nur als Hash gespeichert; für Geschäftsleitung und Buchhaltung ist eine Zwei-Faktor-Anmeldung vorgeschrieben.</p>
    </LegalPage>
  );
}
