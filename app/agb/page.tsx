import type { Metadata } from "next";
import { pricePerDriverCents } from "../../lib/billing";
import { sellerDetails } from "../../lib/legal";
import { TRIAL_DAYS } from "../../lib/tenants";
import { DraftNotice } from "../legal-parts";
import { LegalPage } from "../site-chrome";

export const metadata: Metadata = { title: "AGB — LOGIPAY" };
export const dynamic = "force-dynamic";

export default function AgbPage() {
  const seller = sellerDetails();
  const price = (pricePerDriverCents() / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen">
      <DraftNotice />
      <h2>§ 1 Geltungsbereich</h2>
      <p>Diese AGB gelten für die Nutzung der Software „LOGIPAY“ (nachfolgend „Dienst“) von {seller.company} (nachfolgend „Anbieter“) durch Unternehmer im Sinne von § 14 BGB (nachfolgend „Kunde“). Verbraucher sind von der Nutzung ausgeschlossen. Abweichende Bedingungen des Kunden gelten nicht.</p>
      <h2>§ 2 Leistungen</h2>
      <p>Der Anbieter stellt den Dienst als Software-as-a-Service über das Internet bereit. Der Funktionsumfang ergibt sich aus der Leistungsbeschreibung auf der Website. Der Dienst unterstützt die Lohnvorbereitung; die Entgeltabrechnung einschließlich Steuern und Sozialversicherung sowie die Prüfung exportierter Daten bleiben in der Verantwortung des Kunden bzw. seines Steuerberaters.</p>
      <p>Der Anbieter strebt eine Verfügbarkeit von 99 % im Monatsmittel an. Ausgenommen sind angekündigte Wartungen und Störungen, die der Anbieter nicht zu vertreten hat.</p>
      <h2>§ 3 Testphase und Vertragsschluss</h2>
      <p>Nach der Registrierung kann der Kunde den Dienst {TRIAL_DAYS} Tage kostenlos testen. Die Testphase endet automatisch und verpflichtet nicht zum Abschluss. Ein kostenpflichtiger Vertrag kommt zustande, wenn der Kunde im Portal ein Abonnement abschließt.</p>
      <h2>§ 4 Preise und Zahlung</h2>
      <p>Das Entgelt beträgt {price} pro aktivem Fahrer und Monat zuzüglich gesetzlicher Umsatzsteuer, sofern nicht anders vereinbart. Maßgeblich ist die Zahl der im Portal als aktiv geführten Mitarbeiter; Änderungen werden anteilig berücksichtigt. Die Abrechnung erfolgt monatlich im Voraus über den Zahlungsdienstleister Stripe.</p>
      <h2>§ 5 Laufzeit und Kündigung</h2>
      <p>Das Abonnement läuft monatlich und verlängert sich jeweils um einen Monat, wenn es nicht vor Ablauf des laufenden Monats im Kundenportal gekündigt wird. Das Recht zur außerordentlichen Kündigung bleibt unberührt.</p>
      <h2>§ 6 Pflichten des Kunden</h2>
      <p>Der Kunde hält seine Zugangsdaten geheim, legt Zugänge nur für berechtigte Personen an und ist für die Rechtmäßigkeit der von ihm gespeicherten Daten verantwortlich, insbesondere für die Information seiner Beschäftigten (z. B. über GPS-Ortung) und erforderliche Vereinbarungen mit einem Betriebsrat.</p>
      <h2>§ 7 Daten, Export und Löschung</h2>
      <p>Die vom Kunden gespeicherten Daten bleiben sein Eigentum. Der Kunde kann sie jederzeit exportieren. Nach Vertragsende kann der Kunde seine Firma im Portal löschen; andernfalls löscht der Anbieter die Daten spätestens 90 Tage nach Vertragsende. Für personenbezogene Daten gilt der <a href="/avv">Vertrag zur Auftragsverarbeitung</a>.</p>
      <h2>§ 8 Haftung</h2>
      <p>Der Anbieter haftet unbeschränkt bei Vorsatz, grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt, höchstens auf die vom Kunden in den letzten zwölf Monaten gezahlten Entgelte. Im Übrigen ist die Haftung ausgeschlossen.</p>
      <h2>§ 9 Änderungen</h2>
      <p>Der Anbieter kann diese AGB und die Preise mit einer Frist von sechs Wochen ändern. Die Änderung wird dem Kunden per E-Mail mitgeteilt. Widerspricht der Kunde nicht innerhalb dieser Frist, gilt die Änderung als angenommen; auf diese Folge wird in der Mitteilung hingewiesen. Bei Widerspruch kann jede Partei zum Änderungszeitpunkt kündigen.</p>
      <h2>§ 10 Schlussbestimmungen</h2>
      <p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist der Sitz des Anbieters, soweit der Kunde Kaufmann ist.</p>
    </LegalPage>
  );
}
