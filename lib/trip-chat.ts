import { env } from "@logipay/env";
import type { PortalUser } from "./auth";

export type ChatLocale = "de" | "pl" | "uk" | "ru";

type TripAccess = {
  id: number;
  planning_id: number;
  staff_id: number | null;
  driver_name: string | null;
  license_plate: string | null;
  block_id: string | null;
  staff_user_id: number | null;
};

export async function requireTripAccess(user: PortalUser, tripOperationId: number) {
  const trip = await env.DB.prepare(
    `SELECT o.id, o.planning_id, p.staff_id, p.driver_name, p.license_plate, p.block_id, s.user_id AS staff_user_id
     FROM trip_operations o
     JOIN weekly_planning p ON p.id=o.planning_id
     LEFT JOIN staff s ON s.id=p.staff_id
     WHERE o.id=?`,
  ).bind(tripOperationId).first<TripAccess>();
  if (!trip) return { error: "Tour nicht gefunden", status: 404 } as const;
  if (user.role === "accountant") return { error: "Keine Berechtigung", status: 403 } as const;
  if (user.role === "driver" && Number(trip.staff_user_id) !== user.id && trip.driver_name !== user.fullName)
    return { error: "Diese Tour ist Ihnen nicht zugeteilt", status: 403 } as const;
  return { trip } as const;
}

export function normalizeLocale(value: unknown): ChatLocale {
  return ["de", "pl", "uk", "ru"].includes(String(value)) ? String(value) as ChatLocale : "de";
}

export function detectLanguage(text: string, preferred: ChatLocale): ChatLocale {
  if (/[іїєґІЇЄҐ]/.test(text)) return "uk";
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) return "pl";
  if (/[а-яёА-ЯЁ]/.test(text)) return "ru";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  return preferred;
}

type TripMessageRow = {
  id: number;
  trip_operation_id: number;
  sender_user_id: number;
  message_type: string;
  body: string | null;
  object_key: string | null;
  recipient_read_count: number;
};

export async function deleteTripMessage(user: PortalUser, messageId: number) {
  const message = await env.DB.prepare(
    `SELECT m.id, m.trip_operation_id, m.sender_user_id, m.message_type, m.body, m.object_key,
      (SELECT COUNT(*) FROM trip_message_reads r WHERE r.message_id=m.id AND r.user_id!=m.sender_user_id) AS recipient_read_count
     FROM trip_messages m WHERE m.id=?`,
  ).bind(messageId).first<TripMessageRow>();
  if (!message) return { error: "Nachricht nicht gefunden", status: 404 as const };

  const access = await requireTripAccess(user, Number(message.trip_operation_id));
  if ("error" in access) return { error: access.error, status: access.status as 403 | 404 };

  const canModerate = user.role === "management" || user.role === "dispatcher";
  const isOwnMessage = Number(message.sender_user_id) === user.id;

  if (!canModerate && !isOwnMessage)
    return { error: "Nur eigene Nachrichten können gelöscht werden", status: 403 as const };

  if (!canModerate && Number(message.recipient_read_count) > 0)
    return { error: "Nachricht wurde bereits gelesen und kann nicht gelöscht werden", status: 409 as const };

  await env.DB.batch([
    env.DB.prepare("DELETE FROM trip_message_reads WHERE message_id=?").bind(messageId),
    env.DB.prepare("DELETE FROM trip_messages WHERE id=?").bind(messageId),
  ]);

  if (message.object_key) {
    try { await env.DOCUMENTS.delete(String(message.object_key)); } catch { /* attachment may already be gone */ }
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'deleteTripMessage', ?, ?, ?)",
  ).bind(user.id, String(messageId), JSON.stringify({
    tripOperationId: message.trip_operation_id,
    messageType: message.message_type,
    hadAttachment: Boolean(message.object_key),
  }), now).run();

  return { ok: true as const };
}
