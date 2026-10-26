import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalUser } from "../../lib/auth";
import { TRIAL_DAYS } from "../../lib/tenants";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "LOGIPAY — Firma registrieren",
  description: `LOGIPAY ${TRIAL_DAYS} Tage kostenlos testen.`,
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getPortalUser()) redirect("/");
  return (
    <div className="site">
      <SiteHeader cta={false} />
      <main className="register-page">
        <div className="register-intro">
          <p className="eyebrow">KOSTENLOS TESTEN</p>
          <h1>Ihr Portal in einer Minute</h1>
          <p>{TRIAL_DAYS} Tage alle Funktionen, ohne Kreditkarte. Danach entscheiden Sie, ob Sie ein Abonnement abschließen.</p>
          <ul className="check-list"><li>Eigene, getrennte Datenbank für Ihre Firma</li><li>Fahrer, Fahrzeuge und Büro-Zugänge selbst anlegen</li><li>Daten jederzeit exportieren oder löschen</li></ul>
        </div>
        <RegisterForm />
      </main>
      <SiteFooter />
    </div>
  );
}
