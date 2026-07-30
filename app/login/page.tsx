import { redirect } from "next/navigation";
import { getPortalUser } from "../../lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getPortalUser()) redirect("/");
  return <LoginForm />;
}
