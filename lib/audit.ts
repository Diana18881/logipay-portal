import { env } from "@logipay/env";

/** Records who opened which stored file, so access to personnel data can be traced. */
export async function logFileAccess(userId: number, kind: string, entityId: string) {
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'viewFile', ?, ?, ?)")
    .bind(userId, entityId, JSON.stringify({ kind }), new Date().toISOString()).run();
}
