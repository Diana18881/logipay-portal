import type { Metadata } from "next";
import { sellerDetails } from "../../lib/legal";
import { DraftNotice, subprocessors } from "../legal-parts";
import { LegalPage } from "../site-chrome";

export const metadata: Metadata = { title: "Auftragsverarbeitung (AVV) — LOGIPAY" };
export const dynamic = "force-dynamic";

export default function AvvPage() {
  const seller = sellerDetails();
  return (
    <LegalPage title="Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO">
      <DraftNotice />
      <p>Zwischen dem Kunden (Verantwortlicher, nachfolgend „Auftraggeber“) und {seller.company} (Auftragsverarbeiter, nachfolgend „Auftragnehmer“). Der Vertrag wird mit der Registrierung abgeschlossen und gilt für die Dauer der Nutzung des Dienstes.</p>
      <h2>1. Gegenstand und Dauer</h2>
      <p>Der Auftragnehmer verarbeitet personenbezogene Daten im Auftrag des Auftraggebers, um den Dienst LOGIPAY bereitzustellen (Hosting, Speicherung, Anzeige, Export). Die Dauer entspricht der Laufzeit des Nutzungsvertrags.</p>
      <h2>2. Art der Daten und Betroffene</h2>
      <p>Betroffene: Beschäftigte, Bewerber und ehemalige Beschäftigte des Auftraggebers sowie Ansprechpartner seiner Auftraggeber.</p>
      <p>Datenarten: Stammdaten (Name, Kontaktdaten, Personalnummer), Vertrags- und Vergütungsdaten, Arbeits- und Abwesenheitszeiten (einschließlich Krankheitstagen ohne Diagnose), Tour- und Fahrzeugdaten, GPS-Positionen und Lenkzeiten, Belege und Auslagen, hochgeladene Dokumente (z. B. Führerschein, Verträge), Nachrichten und Sprachnachrichten, Protokolldaten.</p>
      <h2>3. Weisungen</h2>
      <p>Der Auftragnehmer verarbeitet die Daten nur auf dokumentierte Weisung des Auftraggebers; die Nutzung der Funktionen des Dienstes gilt als Weisung. Ist der Auftragnehmer der Ansicht, dass eine Weisung gegen Datenschutzrecht verstößt, weist er den Auftraggeber darauf hin.</p>
      <h2>4. Vertraulichkeit</h2>
      <p>Personen, die Zugang zu den Daten haben, sind zur Vertraulichkeit verpflichtet.</p>
      <h2>5. Technische und organisatorische Maßnahmen (Art. 32 DSGVO)</h2>
      <ul>
        <li>Getrennte Datenbank und getrennter Dateispeicher je Auftraggeber (Mandantentrennung)</li>
        <li>Verschlüsselte Übertragung (TLS) und verschlüsselte Speicherung beim Hosting-Dienstleister</li>
        <li>Rollenbasierte Zugriffsrechte; Zwei-Faktor-Anmeldung für Geschäftsleitung und Buchhaltung</li>
        <li>Passwörter nur als PBKDF2-Hash; Sperre nach wiederholten Fehlversuchen</li>
        <li>Protokollierung von Anmeldungen, Änderungen und Dokumentenzugriffen</li>
        <li>Rechenzentren in der EU mit Zertifizierungen der Dienstleister (u. a. ISO 27001, SOC 2)</li>
        <li>Datenexport und vollständige Löschung durch den Auftraggeber im Portal</li>
      </ul>
      <h2>6. Unterauftragsverarbeiter</h2>
      <p>Der Auftraggeber genehmigt die folgenden Unterauftragsverarbeiter. Über Änderungen informiert der Auftragnehmer vorab; der Auftraggeber kann aus wichtigem Grund widersprechen.</p>
      <ul>{subprocessors.map(([name, purpose, transfer]) => <li key={name}><b>{name}</b> – {purpose}. Garantien: {transfer}.</li>)}</ul>
      <h2>7. Unterstützung des Auftraggebers</h2>
      <p>Der Auftragnehmer unterstützt den Auftraggeber bei Anfragen Betroffener (Art. 12–23 DSGVO), bei der Meldung von Datenschutzverletzungen (Art. 33, 34) und bei Datenschutz-Folgenabschätzungen. Betroffenenrechte kann der Auftraggeber weitgehend selbst im Portal erfüllen (Auskunft, Berichtigung, Export, Löschung).</p>
      <h2>8. Meldung von Verletzungen</h2>
      <p>Der Auftragnehmer meldet dem Auftraggeber Verletzungen des Schutzes personenbezogener Daten unverzüglich, möglichst innerhalb von 24 Stunden nach Kenntnis.</p>
      <h2>9. Löschung und Rückgabe</h2>
      <p>Nach Vertragsende kann der Auftraggeber seine Daten exportieren und die Firma im Portal löschen. Andernfalls löscht der Auftragnehmer die Daten spätestens 90 Tage nach Vertragsende, soweit keine gesetzliche Pflicht zur Speicherung besteht.</p>
      <h2>10. Kontrollen</h2>
      <p>Der Auftragnehmer stellt dem Auftraggeber die zum Nachweis der Pflichten erforderlichen Informationen zur Verfügung und ermöglicht Überprüfungen nach rechtzeitiger Ankündigung. Kontakt: {seller.email}.</p>
    </LegalPage>
  );
}
