import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Portal } from "./portal";
import { Landing } from "./landing";
import { getPortalUser } from "../lib/auth";
import { companyAccess, getCompany } from "../lib/tenants";

export const metadata: Metadata = {
  title: "LOGIPAY — Lohn, Touren und Fahrer-App für Transportunternehmen",
  description: "Lohnabrechnung mit DATEV-Export, Disposition, Belege und Fahrer-App in einem Portal. 30 Tage kostenlos testen.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getPortalUser();
  if (!user) return <Landing />;
  const access = companyAccess(await getCompany(user.companyId));
  if (!access.allowed) redirect(user.role === "management" ? "/abo" : "/login?gesperrt=1");
  return <Portal currentUser={user} trialDaysLeft={access.reason === "trialing" ? access.daysLeft : null} paymentProblem={access.reason === "past_due"} />;
}
