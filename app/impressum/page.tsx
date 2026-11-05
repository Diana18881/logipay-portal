import type { Metadata } from "next";
import { sellerDetails } from "../../lib/legal";
import { DraftNotice, SellerAddress } from "../legal-parts";
import { LegalPage } from "../site-chrome";

export const metadata: Metadata = { title: "Impressum — LOGIPAY" };
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  const seller = sellerDetails();
  return (
    <LegalPage title="Impressum">
      <DraftNotice />
      <h2>Angaben gemäß § 5 DDG</h2>
      <SellerAddress />
      <p>Vertreten durch: {seller.representative}</p>
      <h2>Kontakt</h2>
      <p>Telefon: {seller.phone}<br />E-Mail: {seller.email}</p>
      {seller.register ? <><h2>Registereintrag</h2><p>{seller.register}</p></> : null}
      <h2>Umsatzsteuer-ID</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {seller.vatId}</p>
      <h2>Bildnachweis</h2>
      <p>Titelbild: Volvo FH (2024), Foto von Lars Ardarve, <a href="https://commons.wikimedia.org/wiki/File:Volvo_FH_(2024).jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>, Lizenz <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. Zugeschnitten, Kennzeichen unkenntlich gemacht.</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Das Angebot richtet sich ausschließlich an Unternehmen. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </LegalPage>
  );
}
