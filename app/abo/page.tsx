import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalUser } from "../../lib/auth";
import { billingConfigured, countSeats, pricePerDriverCents } from "../../lib/billing";
import { companyAccess, getCompany } from "../../lib/tenants";
import { AboActions } from "./abo-actions";

export const metadata: Metadata = { title: "LOGIPAY — Abonnement & Daten" };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  trialing: "Testphase",
  active: "Aktiv",
  past_due: "Zahlung offen",
  canceled: "Beendet",
};

export default async function AboPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getPortalUser();
  if (!user) redirect("/login");
  if (user.role !== "management") redirect("/");
  const company = await getCompany(user.companyId, true);
  if (!company) redirect("/login");
  const access = companyAccess(company);
  const seats = await countSeats(company.id);
  const price = pricePerDriverCents() / 100;
  const params = await searchParams;
  const euro = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  return (
    <main className="abo-page">
      <header className="abo-header"><Link href="/" className="site-logo"><span className="brand-mark"><span /><span /><span /></span><strong>LOGIPAY</strong></Link>{access.allowed ? <Link href="/" className="site-button site-button-ghost site-button-small">Zurück zum Portal</Link> : null}</header>
      <section className="abo-card">
        <p className="eyebrow">ABONNEMENT</p>
        <h1>{company.name}</h1>
        {params.status === "ok" ? <div className="login-message-box">Danke! Die Zahlung wird bestätigt – das kann einige Sekunden dauern.</div> : null}
        {!access.allowed ? <div className="login-error">Die Testphase ist abgelaufen. Schließen Sie ein Abonnement ab, um weiterzuarbeiten. Ihre Daten bleiben erhalten.</div> : null}
        <dl className="abo-facts">
          <div><dt>Status</dt><dd>{company.is_demo ? "Demo" : access.reason === "expired" && company.status === "trialing" ? "Testphase abgelaufen" : statusLabels[company.status] || company.status}{access.reason === "trialing" ? ` · noch ${access.daysLeft} Tage` : ""}</dd></div>
          <div><dt>Aktive Fahrer (mind. 1)</dt><dd>{seats}</dd></div>
          <div><dt>Preis</dt><dd>{euro(price)} pro Fahrer / Monat zzgl. MwSt.</dd></div>
          <div><dt>Monatlich</dt><dd>{euro(price * seats)} zzgl. MwSt.</dd></div>
        </dl>
        <AboActions
          billingReady={billingConfigured() && !company.is_demo}
          hasSubscription={Boolean(company.stripe_subscription_id)}
          hasCustomer={Boolean(company.stripe_customer_id)}
          companyName={company.name}
          canDelete={!company.is_demo}
        />
      </section>
    </main>
  );
}
