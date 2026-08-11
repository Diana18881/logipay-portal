import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalUser } from "../../lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "LOGIPAY — Anmeldung",
  description: "Geschützter Zugang zum LOGIPAY Personal- und Logistikportal.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getPortalUser()) redirect("/");
  return <LoginForm />;
}
