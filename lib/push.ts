import { env } from "@logipay/env";

type Sub = { user_id: number; endpoint: string; p256dh: string; auth: string };
type NotificationRow = { id: number; user_id: number | null; role_scope: string | null; title: string; message: string; severity: string | null };

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

export async function ensurePushTable() {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL)",
  ).run();
}

/** Sends Web Push for every notification created at/after `since`. Never throws. */
export async function pushNewNotifications(since: string) {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;
    await ensurePushTable();
    const notes = (await env.DB.prepare("SELECT id, user_id, role_scope, title, message, severity FROM notifications WHERE created_at >= ? ORDER BY id LIMIT 20").bind(since).all<NotificationRow>()).results;
    if (!notes.length) return;
    const subs = (await env.DB.prepare(
      "SELECT s.user_id, s.endpoint, s.p256dh, s.auth, u.role FROM push_subscriptions s JOIN users u ON u.id=s.user_id",
    ).all<Sub & { role: string }>()).results;
    if (!subs.length) return;
    const { default: webpush } = await import("web-push");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@logipay.local", publicKey, privateKey);
    for (const note of notes) {
      const targets = subs.filter((sub: Sub & { role: string }) => note.user_id ? sub.user_id === note.user_id : note.role_scope === "all" || sub.role === note.role_scope);
      const payload = JSON.stringify({ title: note.title, body: note.message, tag: `logipay-${note.id}`, url: "/?section=notifications" });
      await Promise.all(targets.map(async (sub: Sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, urgency: note.severity === "warning" ? "high" : "normal" });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(sub.endpoint).run();
        }
      }));
    }
  } catch { /* push is best-effort */ }
}
