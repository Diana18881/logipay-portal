import { sellerDetails } from "../lib/legal";

export function SellerAddress() {
  const seller = sellerDetails();
  return (
    <p>
      {seller.company}<br />
      {seller.street}<br />
      {seller.city}<br />
      {seller.country}
    </p>
  );
}

export function DraftNotice() {
  if (sellerDetails().complete) return null;
  return <div className="legal-draft">Die Angaben des Anbieters sind noch nicht vollständig hinterlegt.</div>;
}

export const subprocessors = [
  ["Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA", "Hosting der Anwendung und Dateispeicher (Vercel Blob); Rechenzentrum Frankfurt am Main", "EU-Standardvertragsklauseln / EU-US Data Privacy Framework"],
  ["Turso (ChiselStrike Inc.), USA", "Betrieb der Datenbanken; Rechenzentrum in Irland (AWS eu-west-1)", "EU-Standardvertragsklauseln"],
  ["Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA", "Versand von Anmeldecodes per E-Mail (E-Mail-Adresse, Name, Code)", "EU-Standardvertragsklauseln"],
  ["Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin, Irland", "Abwicklung der Abonnement-Zahlungen (nur Daten des Kunden als Vertragspartner, keine Mitarbeiterdaten)", "Sitz in der EU"],
] as const;
