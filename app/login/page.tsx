import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalUser } from "../../lib/auth";
import { companyAccess, getCompany } from "../../lib/tenants";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "LOGIPAY — Anmeldung",
  description: "Geschützter Zugang zum LOGIPAY Personal- und Logistikportal.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getPortalUser();
  if (user) {
    if (companyAccess(await getCompany(user.companyId)).allowed) redirect("/");
    if (user.role === "management") redirect("/abo");
  }
  const params = await searchParams;
  return <LoginForm notice={params.gesperrt ? "Der Zugang Ihrer Firma ist pausiert. Bitte wenden Sie sich an Ihre Geschäftsleitung." : ""} />;
}
