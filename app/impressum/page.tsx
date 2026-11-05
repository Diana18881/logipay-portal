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
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Das Angebot richtet sich ausschließlich an Unternehmen. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </LegalPage>
  );
}
