import type { Metadata } from "next";
import { runAsTenant, tenantFromSessionToken } from "@logipay/env";
import { ensureAuthDatabase } from "../../../lib/auth";
import { findInvitation, invitationUsable } from "../../../lib/invitations";
import { getCompany } from "../../../lib/tenants";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "LOGIPAY — Einladung" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace("-", ".");
  const tenant = tenantFromSessionToken(token);
  const company = tenant ? await getCompany(tenant) : null;
  const invite = tenant && company ? await runAsTenant(tenant, async () => { await ensureAuthDatabase(); return findInvitation(token); }) : null;
  return <InviteForm token={token} valid={invitationUsable(invite)} name={invite?.full_name || ""} email={invite?.email || ""} company={company?.name || ""} />;
}
