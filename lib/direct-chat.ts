import { env } from "@logipay/env";
import type { PortalRole, PortalUser } from "./auth";

export const chatRoles: PortalRole[] = ["management", "dispatcher", "driver"];

type ChatRecipient = { userId: number | null; staffId: number | null; fullName: string; role: PortalRole };

// Staff (management/dispatcher) may message everyone; drivers only reach the office.
export function canMessageRole(sender: PortalRole, recipient: PortalRole) {
  if (!chatRoles.includes(sender) || !chatRoles.includes(recipient)) return false;
  if (sender === "driver") return recipient !== "driver";
  return true;
}

// Staff records that belong to a driver login (linked, or matched by name like elsewhere in the portal).
async function ownStaffIds(user: PortalUser) {
  if (user.role !== "driver") return [];
  const rows = await env.DB.prepare("SELECT id FROM staff WHERE user_id=? OR (user_id IS NULL AND full_name=?)")
    .bind(user.id, user.fullName).all<{ id: number }>();
  return rows.results.map((row: { id: number }) => Number(row.id));
}

const staffIdList = (ids: number[]) => ids.length ? ids.join(",") : "-1";

export async function requireChatRecipient(user: PortalUser, recipientUserId: number, recipientStaffId: number) {
  if (recipientUserId) {
    if (recipientUserId === user.id) return { error: "Empfänger fehlt", status: 400 } as const;
    const partner = await env.DB.prepare("SELECT id, full_name, role, active FROM users WHERE id=?")
      .bind(recipientUserId).first<{ id: number; full_name: string; role: PortalRole; active: number }>();
    if (!partner || !Number(partner.active)) return { error: "Empfänger nicht gefunden", status: 404 } as const;
    if (!canMessageRole(user.role, partner.role)) return { error: "Keine Berechtigung", status: 403 } as const;
    return { recipient: { userId: partner.id, staffId: null, fullName: partner.full_name, role: partner.role } satisfies ChatRecipient } as const;
  }
  if (!recipientStaffId) return { error: "Empfänger fehlt", status: 400 } as const;
  if (!canMessageRole(user.role, "driver")) return { error: "Keine Berechtigung", status: 403 } as const;
  const person = await env.DB.prepare(
    "SELECT s.id, s.full_name, s.user_id, u.active FROM staff s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=?",
  ).bind(recipientStaffId).first<{ id: number; full_name: string; user_id: number | null; active: number | null }>();
  if (!person) return { error: "Empfänger nicht gefunden", status: 404 } as const;
  // A driver who already has an active login is always addressed by the login.
  if (person.user_id && Number(person.active)) return requireChatRecipient(user, Number(person.user_id), 0);
  return { recipient: { userId: null, staffId: person.id, fullName: person.full_name, role: "driver" } satisfies ChatRecipient } as const;
}

// Plate assigned in the fleet list, falling back to the most recent planning entry.
const staffPlateSql = `COALESCE(
  NULLIF((SELECT GROUP_CONCAT(v.license_plate, ', ') FROM vehicles v WHERE v.assigned_staff_id=s.id AND v.status!='archived'), ''),
  (SELECT p.license_plate FROM weekly_planning p WHERE p.staff_id=s.id AND COALESCE(p.license_plate, '')!='' ORDER BY p.planning_year DESC, p.calendar_week DESC, p.id DESC LIMIT 1)
)`;

export async function loadChatContacts(user: PortalUser) {
  if (!chatRoles.includes(user.role)) return [];
  const roles = chatRoles.filter((role) => canMessageRole(user.role, role));
  const users = await env.DB.prepare(
    `SELECT u.id AS user_id, u.full_name, u.role, s.id AS staff_id, s.location, s.company, ${staffPlateSql} AS license_plate
     FROM users u
     LEFT JOIN staff s ON s.id=(SELECT id FROM staff WHERE user_id=u.id OR (user_id IS NULL AND full_name=u.full_name) ORDER BY user_id IS NULL LIMIT 1)
     WHERE u.active=1 AND u.id!=? AND u.role IN (${roles.map(() => "?").join(",")})
     ORDER BY u.role, u.full_name`,
  ).bind(user.id, ...roles).all<Record<string, unknown>>();
  if (!roles.includes("driver")) return users.results;
  // Drivers without a portal login are listed too; their messages wait until a login exists.
  const withoutLogin = await env.DB.prepare(
    `SELECT NULL AS user_id, s.full_name, 'driver' AS role, s.id AS staff_id, s.location, s.company, ${staffPlateSql} AS license_plate
     FROM staff s
     WHERE s.user_id IS NULL AND s.status='active' AND s.full_name NOT IN (SELECT full_name FROM users WHERE active=1)
     ORDER BY s.full_name`,
  ).all<Record<string, unknown>>();
  return [...users.results, ...withoutLogin.results];
}

export async function loadDirectMessages(user: PortalUser) {
  if (!chatRoles.includes(user.role)) return [];
  const staffIds = staffIdList(await ownStaffIds(user));
  const result = await env.DB.prepare(
    `SELECT m.*, u.full_name AS sender_name,
      CASE WHEN m.sender_user_id=? THEN m.recipient_user_id ELSE m.sender_user_id END AS partner_user_id,
      CASE WHEN m.sender_user_id!=? AND m.read_at IS NULL THEN 0 ELSE 1 END AS read_by_me,
      CASE WHEN m.read_at IS NULL THEN 0 ELSE 1 END AS recipient_read_count
     FROM direct_messages m
     JOIN users u ON u.id=m.sender_user_id
     WHERE (m.sender_user_id=? OR m.recipient_user_id=? OR (m.recipient_user_id IS NULL AND m.recipient_staff_id IN (${staffIds})))
       AND m.created_at >= datetime('now', '-180 day')
     ORDER BY m.created_at, m.id`,
  ).bind(user.id, user.id, user.id, user.id).all<Record<string, unknown>>();
  return result.results;
}

export async function markDirectMessagesRead(user: PortalUser, partnerUserId: number, now: string) {
  const staffIds = staffIdList(await ownStaffIds(user));
  const result = await env.DB.prepare(
    `UPDATE direct_messages SET read_at=?
     WHERE sender_user_id=? AND read_at IS NULL
       AND (recipient_user_id=? OR (recipient_user_id IS NULL AND recipient_staff_id IN (${staffIds})))`,
  ).bind(now, partnerUserId, user.id).run();
  return Number(result.meta.changes || 0);
}

type DirectMessageRow = {
  id: number;
  sender_user_id: number;
  recipient_user_id: number | null;
  recipient_staff_id: number | null;
  message_type: string;
  file_name: string | null;
  object_key: string | null;
  content_type: string | null;
  read_at: string | null;
};

export async function getDirectMessageForUser(user: PortalUser, messageId: number) {
  const message = await env.DB.prepare(
    "SELECT id, sender_user_id, recipient_user_id, recipient_staff_id, message_type, file_name, object_key, content_type, read_at FROM direct_messages WHERE id=?",
  ).bind(messageId).first<DirectMessageRow>();
  if (!message) return null;
  if (Number(message.sender_user_id) === user.id || Number(message.recipient_user_id) === user.id) return message;
  if (!message.recipient_user_id && (await ownStaffIds(user)).includes(Number(message.recipient_staff_id))) return message;
  return null;
}

export async function deleteDirectMessage(user: PortalUser, messageId: number) {
  const message = await getDirectMessageForUser(user, messageId);
  if (!message) return { error: "Nachricht nicht gefunden", status: 404 as const };
  const canModerate = user.role === "management" || user.role === "dispatcher";
  const isOwnMessage = Number(message.sender_user_id) === user.id;
  if (!canModerate && !isOwnMessage)
    return { error: "Nur eigene Nachrichten können gelöscht werden", status: 403 as const };
  if (!canModerate && message.read_at)
    return { error: "Nachricht wurde bereits gelesen und kann nicht gelöscht werden", status: 409 as const };

  await env.DB.prepare("DELETE FROM direct_messages WHERE id=?").bind(messageId).run();
  if (message.object_key) {
    try { await env.DOCUMENTS.delete(String(message.object_key)); } catch { /* attachment may already be gone */ }
  }
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'deleteDirectMessage', ?, ?, ?)",
  ).bind(user.id, String(messageId), JSON.stringify({
    recipientUserId: message.recipient_user_id,
    recipientStaffId: message.recipient_staff_id,
    messageType: message.message_type,
    hadAttachment: Boolean(message.object_key),
  }), new Date().toISOString()).run();
  return { ok: true as const };
}
