import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensurePushTable, vapidPublicKey } from "../../../lib/push";

export async function GET() {
  await requirePortalUser();
  return Response.json({ publicKey: vapidPublicKey() });
}

export async function POST(request: Request) {
  const user = await requirePortalUser();
  const body = await request.json().catch(() => null) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return Response.json({ error: "Ungültiges Abonnement" }, { status: 400 });
  await ensurePushTable();
  await env.DB.prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth")
    .bind(user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString()).run();
  return Response.json({ ok: true });
}
