import { env } from "@logipay/env";
import { ensureAuthDatabase } from "../../../../lib/auth";

export async function POST(request: Request) {
  await ensureAuthDatabase();
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return Response.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  const existing = await env.DB.prepare("SELECT id FROM password_reset_requests WHERE email=? AND status='open'").bind(email).first();
  if (!existing) await env.DB.prepare("INSERT INTO password_reset_requests (email, status, created_at) VALUES (?, 'open', ?)").bind(email, new Date().toISOString()).run();
  return Response.json({ message: "Anfrage registriert. Ein Manager erstellt ein neues temporäres Passwort." });
}
