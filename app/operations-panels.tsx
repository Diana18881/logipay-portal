"use client";

import { EmptyState } from "./empty-state";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { driverText, type DriverLocale } from "./driver-i18n";
import { queueOfflineUpload } from "../lib/offline-client";

type Row = Record<string, string | number | null>;
type Action = (payload: Record<string, string | number | null>) => Promise<void>;

const euro = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";
const duration = (value: unknown) => `${Math.floor(Number(value || 0) / 60)}:${String(Number(value || 0) % 60).padStart(2, "0")} Std.`;

function pauseTripChatPlayers(root: ParentNode = document) {
  root.querySelectorAll<HTMLAudioElement>(".trip-chat-stream audio, .chat-center-stream audio").forEach((audio) => {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {
      /* Safari throws EmptyRanges when native controls sync during teardown */
    }
  });
}

function TripChatAudio({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {
      /* ignore Safari media teardown errors */
    }
  }, []);
  return <audio ref={audioRef} controls preload="none" src={src} />;
}

type ChatCopy = {
  sent: string;
  read: string;
  photo: string;
  delete: string;
  deleteConfirm: string;
  deleteDone: string;
  deleteBlocked: string;
};

function TripChatMessage({
  message,
  own,
  canModerate,
  original,
  copy,
  onDelete,
  attachmentBase = "/api/trip-chat",
}: {
  message: Row;
  own: boolean;
  canModerate?: boolean;
  original: string;
  copy: ChatCopy;
  onDelete?: (messageId: number) => void | Promise<void>;
  attachmentBase?: string;
}) {
  const canDelete = canModerate || (own && !Number(message.recipient_read_count));
  return (
    <article className={`trip-chat-message ${own ? "message-own" : "message-other"}${original.startsWith("📦") ? " wa-request" : ""}`}>
      {!own ? <strong className="wa-sender">{message.sender_name}</strong> : null}
      {message.message_type === "voice" ? (
        <TripChatAudio src={`${attachmentBase}/${message.id}/attachment`} />
      ) : null}
      {message.message_type === "photo" ? (
        <a className="trip-chat-photo" href={`${attachmentBase}/${message.id}/attachment`} target="_blank" rel="noreferrer">
          <img src={`${attachmentBase}/${message.id}/attachment`} alt={String(message.file_name || copy.photo)} />
        </a>
      ) : null}
      {original ? <p>{original}</p> : null}
      <footer>
        {canDelete ? (
          <button type="button" className="trip-chat-delete" aria-label={copy.delete} title={copy.delete} onClick={() => void onDelete?.(Number(message.id))}>🗑</button>
        ) : null}
        <time>{new Date(String(message.created_at)).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</time>
        {own ? <span className={`wa-ticks${Number(message.recipient_read_count) ? " wa-read" : ""}`} title={Number(message.recipient_read_count) ? copy.read : copy.sent}>✓✓</span> : null}
      </footer>
    </article>
  );
}

export function UserManagement({ rows, staff, resetRequests, action }: { rows: Row[]; staff: Row[]; resetRequests: Row[]; action: Action }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await action({ action: editing ? "updatePortalUser" : "addPortalUser", id: editing?.id || null, email: String(values.email || ""), fullName: String(values.fullName || ""), role: String(values.role || ""), staffId: String(values.staffId || ""), active: String(values.active || "1"), password: String(values.password || "") });
    setEditing(null); form.reset();
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const password = String(new FormData(form).get("password") || "");
    await action({ action: "adminResetPassword", id: resetting?.id || null, password }); setResetting(null); form.reset();
  }
  return <div className="advanced-stack">
    <div className="admin-feature-grid">
      <div><strong>Rollenbasierter Zugriff</strong><span>Management, Buchhaltung, Disposition und Fahrer erhalten getrennte Rechte.</span></div>
      <div><strong>Startpasswort</strong><span>Neue Benutzer müssen ihr temporäres Passwort beim ersten Login ändern.</span></div>
      <div><strong>Kontoschutz</strong><span>Sperre nach Fehlversuchen, 2FA und vollständiges Login-Journal.</span></div>
      <div><strong>Firmenzugang</strong><span>Konten sind vorbereitet; externe Sites-Freigaben bleiben getrennt kontrollierbar.</span></div>
    </div>
    <div className="panel"><div className="panel-title"><div><h2>{editing ? "Benutzer bearbeiten" : "Benutzer einladen"}</h2><p>Account anlegen, Rolle vergeben und optional mit einem Fahrerprofil verbinden</p></div></div>
      <form className="advanced-form user-admin-form" onSubmit={submit} key={String(editing?.id || "new")}>
        <input name="fullName" required placeholder="Vor- und Nachname" defaultValue={String(editing?.full_name || "")} />
        <input name="email" type="email" required placeholder="name@firma.de" defaultValue={String(editing?.email || "")} />
        <select name="role" required defaultValue={String(editing?.role || "driver")}><option value="management">Management</option><option value="accountant">Buchhaltung</option><option value="dispatcher">Disposition</option><option value="driver">Fahrer</option></select>
        <select name="staffId" defaultValue={String(editing?.staff_id || "")}><option value="">Kein Fahrerprofil</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select>
        {!editing ? <input name="password" type="password" minLength={10} required placeholder="Temporäres Startpasswort" /> : <select name="active" defaultValue={String(editing.active ?? 1)}><option value="1">Aktiv</option><option value="0">Gesperrt</option></select>}
        <button className="primary-button">{editing ? "Änderung speichern" : "Account anlegen"}</button>{editing ? <button type="button" onClick={() => setEditing(null)}>Abbrechen</button> : null}
      </form>
    </div>
    {resetting ? <div className="panel reset-password-panel"><div className="panel-title"><div><h2>Startpasswort für {resetting.full_name}</h2><p>Das Konto wird entsperrt; Passwortwechsel beim nächsten Login ist Pflicht.</p></div></div><form className="advanced-form" onSubmit={resetPassword}><input name="password" type="password" minLength={10} required placeholder="Neues temporäres Passwort" /><button className="primary-button">Passwort zurücksetzen</button><button type="button" onClick={() => setResetting(null)}>Abbrechen</button></form></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>Benutzerverwaltung</h2><p>{rows.filter((row) => Number(row.active)).length} aktive Konten · {resetRequests.length} offene Passwortanfragen</p></div></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Fahrerprofil</th><th>2FA</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong></td><td>{row.email}</td><td>{row.role}</td><td>{row.staff_id || "—"}</td><td>{Number(row.two_factor_enabled) ? <span className="ok-chip">Aktiv</span> : "—"}</td><td>{Number(row.active) ? <span className="ok-chip">Aktiv</span> : <span className="danger-chip">Gesperrt</span>}</td><td><div className="row-buttons"><button className="edit-action" onClick={() => setEditing(row)}>Bearbeiten</button><button className="row-action" onClick={() => setResetting(row)}>Passwort</button></div></td></tr>)}</tbody></table></div></div>
  </div>;
}

export function NotificationsCenter({ rows, driver, locale, action }: { rows: Row[]; driver: boolean; locale: DriverLocale; action: Action }) {
  const unread = rows.filter((row) => !row.read_at);
  const t = (key: string, fallback?: string) => driverText(locale, key, fallback);
  return <div className="panel"><div className="panel-title"><div><h2>{driver ? t("notificationCenter") : "Benachrichtigungszentrum"}</h2><p>{unread.length} {driver ? t("unread") : "ungelesen · Anliegen, Tachograph, Fahrten, Belege und Fahrzeugmängel"}</p></div></div><div className="notification-list">{rows.length ? rows.map((row) => <article key={row.id} className={`notification-card severity-${row.severity} ${row.read_at ? "notification-read" : ""}`}><span className="notification-symbol">{row.severity === "urgent" ? "!" : row.severity === "warning" ? "△" : "i"}</span><div><strong>{row.title}</strong><p>{row.message}</p><small>{dateTime(row.created_at)} · {row.category}</small></div>{!row.read_at ? <button onClick={() => action({ action: "markNotificationRead", id: row.id })}>{driver ? t("markRead") : "Gelesen"}</button> : <span className="ok-chip">{driver ? t("done") : "Erledigt"}</span>}</article>) : <div className="empty-state">{driver ? t("noNotifications") : "Keine Benachrichtigungen"}</div>}</div></div>;
}

export function TachographCenter({ rows, staff, vehicles, canEdit, locale, action }: { rows: Row[]; staff: Row[]; vehicles: Row[]; canEdit: boolean; locale: DriverLocale; action: Action }) {
  const driverView = !canEdit;
  const c = {
    de: { entries: "Aktuelle Einträge", warnings: "Warnungen", source: "Quelle", title: "Fahr- und Ruhezeiten", help: "Restfahrzeit und Verstöße werden hervorgehoben", date: "Datum", driver: "Fahrer", plate: "Kennzeichen", drive: "Fahrzeit", break: "Pause", rest: "Rest", note: "Hinweis", empty: "Noch keine Tachograph-Daten" },
    pl: { entries: "Aktualne wpisy", warnings: "Ostrzeżenia", source: "Źródło", title: "Czas jazdy i odpoczynku", help: "Pozostały czas i naruszenia są wyróżnione", date: "Data", driver: "Kierowca", plate: "Pojazd", drive: "Jazda", break: "Przerwa", rest: "Pozostało", note: "Uwaga", empty: "Brak danych tachografu" },
    uk: { entries: "Поточні записи", warnings: "Попередження", source: "Джерело", title: "Час водіння та відпочинку", help: "Залишок часу та порушення виділяються", date: "Дата", driver: "Водій", plate: "Авто", drive: "Водіння", break: "Перерва", rest: "Залишок", note: "Примітка", empty: "Даних тахографа ще немає" },
    ru: { entries: "Текущие записи", warnings: "Предупреждения", source: "Источник", title: "Время вождения и отдыха", help: "Оставшееся время и нарушения выделяются", date: "Дата", driver: "Водитель", plate: "Машина", drive: "Вождение", break: "Перерыв", rest: "Остаток", note: "Примечание", empty: "Данных тахографа пока нет" },
  }[locale];
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries()); await action({ action: "saveTachograph", ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) }); form.reset(); }
  return <div className="advanced-stack"><div className="tachograph-summary"><div><span>{driverView ? c.entries : "Aktuelle Einträge"}</span><strong>{rows.length}</strong></div><div><span>{driverView ? c.warnings : "Warnungen"}</span><strong>{rows.filter((row) => row.infringement || Number(row.remaining_minutes) <= 90).length}</strong></div><div><span>{driverView ? c.source : "Quelle"}</span><strong>Smart Tacho v2</strong></div></div>
    {canEdit ? <div className="panel"><div className="panel-title"><div><h2>Tachograph-Daten erfassen</h2><p>Manuelle Erfassung oder Vorbereitung für den Import vom Telematik-Anbieter</p></div></div><form className="advanced-form" onSubmit={submit}><select name="staffId" required defaultValue=""><option value="">Fahrer</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select><select name="licensePlate" required defaultValue=""><option value="">Kennzeichen</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select><label>Datum<input name="recordDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Fahrzeit (Min.)<input name="drivingMinutes" type="number" min="0" max="900" defaultValue="0" /></label><label>Pause (Min.)<input name="restMinutes" type="number" min="0" max="1440" defaultValue="0" /></label><label>Restfahrzeit (Min.)<input name="remainingMinutes" type="number" min="0" max="600" defaultValue="540" /></label><input name="infringement" placeholder="Warnung / Verstoß" /><input name="notes" placeholder="Notiz" /><select name="source" defaultValue="manual"><option value="manual">Manuell</option><option value="download">Fahrerkarte</option><option value="telematics">Telematik</option></select><button className="primary-button">Speichern</button></form></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>{driverView ? c.title : "Fahr- und Ruhezeiten"}</h2><p>{driverView ? c.help : "Restfahrzeit und Verstöße werden automatisch hervorgehoben"}</p></div></div><div className="table-wrap"><table><thead><tr><th>{driverView ? c.date : "Datum"}</th><th>{driverView ? c.driver : "Fahrer"}</th><th>{driverView ? c.plate : "Kennzeichen"}</th><th>{driverView ? c.drive : "Fahrzeit"}</th><th>{driverView ? c.break : "Pause"}</th><th>{driverView ? c.rest : "Rest"}</th><th>{driverView ? c.note : "Hinweis"}</th><th>{driverView ? c.source : "Quelle"}</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td>{row.record_date}</td><td>{row.full_name}</td><td><strong>{row.license_plate}</strong></td><td>{duration(row.driving_minutes)}</td><td>{duration(row.rest_minutes)}</td><td><span className={Number(row.remaining_minutes) <= 90 ? "danger-chip" : "ok-chip"}>{duration(row.remaining_minutes)}</span></td><td>{row.infringement || "—"}</td><td>{row.source}</td></tr>) : <tr><td colSpan={8}>{driverView ? c.empty : "Noch keine Tachograph-Daten"}</td></tr>}</tbody></table></div></div></div>;
}

const contactKey = (contact: Row) => contact.user_id ? `user-${contact.user_id}` : `staff-${contact.staff_id}`;

export function TripExecutionCenter({ rows, documents, messages, contacts = [], directMessages = [], driver, currentUserId, chatModerator = false, locale, action, reload, view = "operations", openChat, initialTripId, initialContactKey }: { rows: Row[]; documents: Row[]; messages: Row[]; contacts?: Row[]; directMessages?: Row[]; driver: boolean; currentUserId: number; chatModerator?: boolean; locale: DriverLocale; action: Action; reload: () => Promise<void>; view?: "operations" | "chat"; openChat?: (row: Row) => void; initialTripId?: number | null; initialContactKey?: string | null }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [chatMode, setChatMode] = useState<"people" | "trips">(initialTripId ? "trips" : "people");
  // The portal passes a new action function on every render; keep effects from re-firing because of that.
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; }, [action]);
  const [chatContactKey, setChatContactKey] = useState<string | null>(() => {
    if (initialContactKey) return initialContactKey;
    try {
      const remembered = sessionStorage.getItem("logipay_chat_contact");
      if (remembered && contacts.some((contact) => contactKey(contact) === remembered)) return remembered;
    } catch { /* storage unavailable */ }
    const isUnread = (message: Row) => !Number(message.read_by_me) && Number(message.sender_user_id) !== currentUserId;
    const firstUnread = directMessages.find(isUnread);
    if (firstUnread) return `user-${firstUnread.partner_user_id}`;
    const latest = directMessages[directMessages.length - 1];
    if (latest) return `user-${latest.partner_user_id}`;
    return contacts[0] ? contactKey(contacts[0]) : null;
  });
  const [chatTrip, setChatTrip] = useState<Row | null>(() => {
    if (view !== "chat") return null;
    const requested = initialTripId ? rows.find((row) => Number(row.id) === Number(initialTripId)) : null;
    if (requested) return requested;
    const firstUnread = rows.find((row) => messages.some((message) => Number(message.trip_operation_id) === Number(row.id) && !Number(message.read_by_me) && Number(message.sender_user_id) !== currentUserId));
    return firstUnread || rows[0] || null;
  });
  const [chatSearch, setChatSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [chatNotice, setChatNotice] = useState("");
  const [deletedMessageIds, setDeletedMessageIds] = useState<number[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  useEffect(() => {
    const suppressSafariAudioError = (event: ErrorEvent) => {
      const message = String(event.message || event.error?.message || "");
      if (message.includes("EmptyRanges")) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", suppressSafariAudioError);
    return () => window.removeEventListener("error", suppressSafariAudioError);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries()); await action({ action: "saveTripOperation", planningId: selected?.planning_id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) }); setSelected(null); }
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); try { if (!navigator.onLine) throw new Error("offline"); const response = await fetch("/api/trip-documents", { method: "POST", body: formData }); const result = await response.json() as { error?: string }; if (!response.ok) return window.alert(result.error || "Upload fehlgeschlagen"); form.reset(); await reload(); } catch { await queueOfflineUpload("/api/trip-documents", formData); form.reset(); setChatNotice(driver ? "Документ сохранён офлайн." : "Dokument offline gespeichert."); } }
  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const peopleMode = chatMode === "people";
    if (peopleMode ? !chatContact : !chatTrip) return;
    const endpoint = peopleMode ? "/api/direct-chat" : "/api/trip-chat";
    const form = event.currentTarget;
    const data = new FormData(form);
    if (peopleMode && chatContact?.user_id) data.set("recipientUserId", String(chatContact.user_id));
    else if (peopleMode) data.set("recipientStaffId", String(chatContact?.staff_id));
    else data.set("tripOperationId", String(chatTrip?.id));
    data.set("locale", locale);
    if (recordedBlob) data.set("file", new File([recordedBlob], `tour-voice-${Date.now()}.${recordedBlob.type.includes("mp4") ? "m4a" : "webm"}`, { type: recordedBlob.type || "audio/webm" }));
    data.set("durationSeconds", String(durationSeconds));
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await fetch(endpoint, { method: "POST", body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) return setChatNotice(result.error || "Nachricht konnte nicht gesendet werden");
      form.reset(); setRecordedBlob(null); setDurationSeconds(0); setChatNotice("Nachricht gesendet"); await reload();
    } catch {
      await queueOfflineUpload(endpoint, data); form.reset(); setRecordedBlob(null); setDurationSeconds(0);
      setChatNotice(driver ? "Сообщение сохранено без интернета." : "Nachricht offline gespeichert.");
    }
  }
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream; recorderRef.current = recorder; chunksRef.current = []; startedRef.current = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        setRecordedBlob(new Blob(chunksRef.current, { type }));
        setDurationSeconds(Math.max(1, Math.round((Date.now() - startedRef.current) / 1000)));
        stream.getTracks().forEach((track) => track.stop()); setRecording(false);
      };
      recorder.start(); setRecording(true); setChatNotice("");
    } catch { setChatNotice(driver ? "Kein Mikrofonzugriff" : "Mikrofonzugriff nicht erlaubt"); }
  }
  function stopRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const isUnreadMessage = (message: Row) => !Number(message.read_by_me) && Number(message.sender_user_id) !== currentUserId;
  const chatContact = contacts.find((contact) => contactKey(contact) === chatContactKey) || null;
  const contactMessages = (contact: Row | null) => contact ? directMessages.filter((message) =>
    (contact.user_id && Number(message.partner_user_id) === Number(contact.user_id))
    || (!message.recipient_user_id && contact.staff_id && Number(message.recipient_staff_id) === Number(contact.staff_id) && Number(message.sender_user_id) === currentUserId)) : [];
  const unreadOpenChat = view === "chat" && chatMode === "trips" && chatTrip ? messages.filter((message) => Number(message.trip_operation_id) === Number(chatTrip.id) && isUnreadMessage(message)).length : 0;
  const unreadOpenContact = view === "chat" && chatMode === "people" ? contactMessages(chatContact).filter(isUnreadMessage).length : 0;
  useEffect(() => {
    if (chatTrip && unreadOpenChat) void actionRef.current({ action: "markTripMessagesRead", tripOperationId: chatTrip.id });
  }, [chatTrip, unreadOpenChat]);
  useEffect(() => {
    if (chatContact?.user_id && unreadOpenContact) void actionRef.current({ action: "markDirectMessagesRead", partnerUserId: chatContact.user_id });
  }, [chatContact?.user_id, unreadOpenContact]);
  useEffect(() => {
    if (!chatContactKey) return;
    try { sessionStorage.setItem("logipay_chat_contact", chatContactKey); } catch { /* storage unavailable */ }
  }, [chatContactKey]);
  const statuses = ["Geplant", "Gestartet", "Beladen", "Unterwegs", "Zugestellt", "Problem"];
  const c = {
    de: { noPlate: "Ohne Kennzeichen", from: "Von", to: "Nach", update: "Status aktualisieren", empty: "Für diese Woche gibt es noch keine Touren.", title: "Tour", help: "Status, Ziel, Ankunft und Problem melden", pickup: "Ladeadresse", delivery: "Lieferadresse", delay: "Verspätung / Problem", recipient: "Empfänger", signature: "Unterschrift (Name)", save: "Tour speichern", close: "Schließen", docType: "Dokumentart", upload: "Foto / Dokument hochladen", documents: "CMR & Zustellnachweise", docsHelp: "Geschützte Dokumente und Fotos je Tour", time: "Zeit", driver: "Fahrer", kind: "Art", file: "Datei", noDocs: "Noch keine Tourdokumente", chat: "Tour-Chat", chatHelp: "Text, Sprache und Fotos sicher mit der Disposition austauschen", write: "Nachricht schreiben …", photo: "Foto / Audio", record: "Sprache aufnehmen", stop: "Aufnahme stoppen", send: "Senden", sent: "Gesendet", read: "Gelesen", delete: "Löschen", deleteConfirm: "Nachricht wirklich löschen?", deleteDone: "Nachricht gelöscht", deleteBlocked: "Bereits gelesen — Löschen nicht möglich", noMessages: "Noch keine Nachrichten in dieser Tour", status: { Geplant: "Geplant", Gestartet: "Gestartet", Beladen: "Beladen", Unterwegs: "Unterwegs", Zugestellt: "Zugestellt", Problem: "Problem" } },
    pl: { noPlate: "Bez numeru", from: "Z", to: "Do", update: "Zmień status", empty: "Brak tras na ten tydzień.", title: "Trasa", help: "Zmień status, cel, czas przyjazdu lub zgłoś problem", pickup: "Adres załadunku", delivery: "Adres dostawy", delay: "Opóźnienie / problem", recipient: "Odbiorca", signature: "Podpis (imię)", save: "Zapisz trasę", close: "Zamknij", docType: "Rodzaj dokumentu", upload: "Wyślij zdjęcie / dokument", documents: "CMR i potwierdzenia", docsHelp: "Chronione dokumenty i zdjęcia trasy", time: "Czas", driver: "Kierowca", kind: "Typ", file: "Plik", noDocs: "Brak dokumentów", chat: "Czat trasy", chatHelp: "Tekst, głos i zdjęcia bezpiecznie połączone z trasą", write: "Napisz wiadomość …", photo: "Zdjęcie / audio", record: "Nagraj głos", stop: "Zatrzymaj", send: "Wyślij", sent: "Wysłano", read: "Odczytano", delete: "Usuń", deleteConfirm: "Usunąć tę wiadomość?", deleteDone: "Wiadomość usunięta", deleteBlocked: "Już odczytano — nie można usunąć", noMessages: "Brak wiadomości w tej trasie", status: { Geplant: "Zaplanowana", Gestartet: "Rozpoczęta", Beladen: "Załadowana", Unterwegs: "W drodze", Zugestellt: "Dostarczona", Problem: "Problem" } },
    uk: { noPlate: "Без номера", from: "Звідки", to: "Куди", update: "Змінити статус", empty: "На цей тиждень рейсів немає.", title: "Рейс", help: "Змініть статус, адресу, час прибуття або повідомте про проблему", pickup: "Адреса завантаження", delivery: "Адреса доставки", delay: "Запізнення / проблема", recipient: "Одержувач", signature: "Підпис (ім’я)", save: "Зберегти рейс", close: "Закрити", docType: "Тип документа", upload: "Завантажити фото / документ", documents: "CMR та підтвердження", docsHelp: "Захищені документи й фото рейсу", time: "Час", driver: "Водій", kind: "Тип", file: "Файл", noDocs: "Документів рейсу ще немає", chat: "Чат рейсу", chatHelp: "Текст, голос і фото захищено прив’язані до рейсу", write: "Напишіть повідомлення …", photo: "Фото / аудіо", record: "Записати голос", stop: "Зупинити", send: "Надіслати", sent: "Надіслано", read: "Прочитано", delete: "Видалити", deleteConfirm: "Видалити це повідомлення?", deleteDone: "Повідомлення видалено", deleteBlocked: "Вже прочитано — видалити неможливо", noMessages: "У цьому рейсі повідомлень немає", status: { Geplant: "Заплановано", Gestartet: "Розпочато", Beladen: "Завантажено", Unterwegs: "У дорозі", Zugestellt: "Доставлено", Problem: "Проблема" } },
    ru: { noPlate: "Без номера", from: "Откуда", to: "Куда", update: "Изменить статус", empty: "На эту неделю рейсов нет.", title: "Рейс", help: "Измените статус, адрес, время прибытия или сообщите о проблеме", pickup: "Адрес загрузки", delivery: "Адрес доставки", delay: "Опоздание / проблема", recipient: "Получатель", signature: "Подпись (имя)", save: "Сохранить рейс", close: "Закрыть", docType: "Тип документа", upload: "Загрузить фото / документ", documents: "CMR и подтверждения", docsHelp: "Защищённые документы и фото рейса", time: "Время", driver: "Водитель", kind: "Тип", file: "Файл", noDocs: "Документов рейса пока нет", chat: "Чат рейса", chatHelp: "Текст, голос и фотографии защищённо привязаны к рейсу", write: "Напишите сообщение …", photo: "Фото / аудио", record: "Записать голос", stop: "Остановить", send: "Отправить", sent: "Отправлено", read: "Прочитано", delete: "Удалить", deleteConfirm: "Удалить это сообщение?", deleteDone: "Сообщение удалено", deleteBlocked: "Уже прочитано — удалить нельзя", noMessages: "В этом рейсе сообщений пока нет", status: { Geplant: "Запланирован", Gestartet: "Начат", Beladen: "Загружен", Unterwegs: "В пути", Zugestellt: "Доставлен", Problem: "Проблема" } },
  }[locale];
  const chatCopy: ChatCopy = {
    sent: c.sent,
    read: c.read,
    photo: c.photo,
    delete: c.delete,
    deleteConfirm: c.deleteConfirm,
    deleteDone: c.deleteDone,
    deleteBlocked: c.deleteBlocked,
  };
  async function deleteMessage(messageId: number) {
    const peopleMode = chatMode === "people";
    const message = (peopleMode ? directMessages : messages).find((item) => Number(item.id) === messageId);
    if (!message) return;
    const own = Number(message.sender_user_id) === currentUserId;
    if (!chatModerator && !own) return;
    if (!chatModerator && Number(message.recipient_read_count) > 0) {
      setChatNotice(chatCopy.deleteBlocked);
      return;
    }
    if (!window.confirm(chatCopy.deleteConfirm)) return;
    pauseTripChatPlayers();
    setDeletedMessageIds((current) => [...current, messageId]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      await action({ action: peopleMode ? "deleteDirectMessage" : "deleteTripMessage", id: messageId });
      setChatNotice(chatCopy.deleteDone);
      await reload();
    } finally {
      setDeletedMessageIds((current) => current.filter((id) => id !== messageId));
    }
  }
  const visibleMessages = (items: Row[]) => items.filter((message) => !deletedMessageIds.includes(Number(message.id)));
  const activeMessages = chatMode === "people"
    ? visibleMessages(contactMessages(chatContact))
    : chatTrip ? visibleMessages(messages.filter((message) => Number(message.trip_operation_id) === Number(chatTrip.id))) : [];
  const inboxCopy = {
    de: { title: "Tour-Nachrichten", subtitle: "Fahrer und Disposition bleiben je Tour verbunden", search: "Fahrer, Kennzeichen oder Block suchen", all: "Alle", unread: "Ungelesen", empty: "Keine Tour-Chats für diese Woche", select: "Wählen Sie links eine Tour aus", noConversation: "Noch keine Nachricht – beginnen Sie die Unterhaltung", voice: "Sprachnachricht", photo: "Foto" },
    pl: { title: "Wiadomości z tras", subtitle: "Kierowca i dyspozytor rozmawiają w kontekście trasy", search: "Szukaj kierowcy, pojazdu lub bloku", all: "Wszystkie", unread: "Nieprzeczytane", empty: "Brak czatów w tym tygodniu", select: "Wybierz trasę po lewej", noConversation: "Brak wiadomości – rozpocznij rozmowę", voice: "Wiadomość głosowa", photo: "Zdjęcie" },
    uk: { title: "Повідомлення рейсів", subtitle: "Водій і диспетчер спілкуються в межах рейсу", search: "Пошук водія, авто або блоку", all: "Усі", unread: "Непрочитані", empty: "Цього тижня чатів немає", select: "Оберіть рейс ліворуч", noConversation: "Повідомлень ще немає — почніть розмову", voice: "Голосове повідомлення", photo: "Фото" },
    ru: { title: "Сообщения рейсов", subtitle: "Водитель и диспетчер общаются внутри конкретного рейса", search: "Поиск водителя, машины или блока", all: "Все", unread: "Непрочитанные", empty: "На этой неделе чатов нет", select: "Выберите рейс слева", noConversation: "Сообщений пока нет — начните переписку", voice: "Голосовое сообщение", photo: "Фото" },
  }[locale];
  const peopleCopy = {
    de: { people: "Personen", trips: "Touren", title: "Nachrichten", subtitle: "Alle Fahrer, Disposition und Management", search: "Name, Kennzeichen oder Rolle suchen", empty: "Keine Kontakte gefunden", select: "Wählen Sie links eine Person aus", noLogin: "Noch kein Portalzugang – der Fahrer sieht die Nachricht nach dem ersten Login", roles: { management: "Management", dispatcher: "Disposition", driver: "Fahrer" } },
    pl: { people: "Osoby", trips: "Trasy", title: "Wiadomości", subtitle: "Wszyscy kierowcy, dyspozycja i zarząd", search: "Szukaj osoby, pojazdu lub roli", empty: "Brak kontaktów", select: "Wybierz osobę po lewej", noLogin: "Brak dostępu do portalu – kierowca zobaczy wiadomość po pierwszym logowaniu", roles: { management: "Zarząd", dispatcher: "Dyspozytor", driver: "Kierowca" } },
    uk: { people: "Люди", trips: "Рейси", title: "Повідомлення", subtitle: "Усі водії, диспетчери та керівництво", search: "Пошук за ім’ям, номером або роллю", empty: "Контактів не знайдено", select: "Оберіть людину ліворуч", noLogin: "Ще немає доступу до порталу – водій побачить повідомлення після першого входу", roles: { management: "Керівництво", dispatcher: "Диспетчер", driver: "Водій" } },
    ru: { people: "Люди", trips: "Рейсы", title: "Сообщения", subtitle: "Все водители, диспетчеры и руководство", search: "Поиск по имени, номеру или роли", empty: "Контакты не найдены", select: "Выберите человека слева", noLogin: "Пока нет доступа к порталу – водитель увидит сообщение после первого входа", roles: { management: "Руководство", dispatcher: "Диспетчер", driver: "Водитель" } },
  }[locale];
  const roleLabel = (role: unknown) => peopleCopy.roles[String(role) as keyof typeof peopleCopy.roles] || String(role || "");
  const contactSubtitle = (contact: Row) => contact.role === "driver"
    ? `🚚 ${contact.license_plate || c.noPlate}${contact.location ? ` · ${contact.location}` : ""}`
    : roleLabel(contact.role);
  const initials = (value: unknown) => String(value || "?").split(" ").map((part) => part[0]).join("").slice(0, 2);
  const requestItems: { de: string; pl: string; uk: string; ru: string }[] = [
    { de: "Ersatzteil", pl: "Część zamienna", uk: "Запчастина", ru: "Запчасть" },
    { de: "AdBlue", pl: "AdBlue", uk: "AdBlue", ru: "AdBlue" },
    { de: "Kraftstoff / Tankkarte", pl: "Paliwo / karta paliwowa", uk: "Пальне / паливна картка", ru: "Топливо / топливная карта" },
    { de: "Spanngurte / Ladungssicherung", pl: "Pasy / zabezpieczenie ładunku", uk: "Ремені / кріплення вантажу", ru: "Ремни / крепление груза" },
    { de: "Dokumente / Papiere", pl: "Dokumenty", uk: "Документи", ru: "Документы" },
    { de: "Sonstiges", pl: "Inne", uk: "Інше", ru: "Другое" },
  ];
  const requestCopy = { de: { title: "Brauchen Sie etwas?" }, pl: { title: "Potrzebujesz czegoś?" }, uk: { title: "Вам щось потрібно привезти?" }, ru: { title: "Нужно что-то привезти?" } }[locale];
  const chatRows = rows.map((row) => {
    const rowMessages = messages.filter((message) => Number(message.trip_operation_id) === Number(row.id));
    const latest = rowMessages[rowMessages.length - 1];
    const unread = rowMessages.filter((message) => !Number(message.read_by_me) && Number(message.sender_user_id) !== currentUserId).length;
    return { row, latest, unread };
  }).filter(({ row, unread }) => {
    const haystack = `${row.driver_name || ""} ${row.license_plate || ""} ${row.block_id || ""} ${row.company || ""}`.toLowerCase();
    return haystack.includes(chatSearch.trim().toLowerCase()) && (!unreadOnly || unread > 0);
  }).sort((left, right) => new Date(String(right.latest?.created_at || 0)).getTime() - new Date(String(left.latest?.created_at || 0)).getTime());
  const rolePriority: Record<string, number> = { management: 0, dispatcher: 1, driver: 2 };
  const contactRows = contacts.map((contact) => {
    const contactThread = contactMessages(contact);
    return { contact, latest: contactThread[contactThread.length - 1], unread: contactThread.filter(isUnreadMessage).length };
  }).filter(({ contact, unread }) => {
    const haystack = `${contact.full_name || ""} ${contact.license_plate || ""} ${roleLabel(contact.role)} ${contact.company || ""} ${contact.location || ""}`.toLowerCase();
    return haystack.includes(chatSearch.trim().toLowerCase()) && (!unreadOnly || unread > 0);
  }).sort((left, right) => (right.unread ? 1 : 0) - (left.unread ? 1 : 0)
    || new Date(String(right.latest?.created_at || 0)).getTime() - new Date(String(left.latest?.created_at || 0)).getTime()
    || (rolePriority[String(left.contact.role)] ?? 9) - (rolePriority[String(right.contact.role)] ?? 9)
    || String(left.contact.full_name).localeCompare(String(right.contact.full_name), "de"));
  const unreadTrips = messages.filter(isUnreadMessage).length;
  const unreadPeople = directMessages.filter(isUnreadMessage).length;
  const previewText = (latest: Row | undefined) => latest?.body ? String(latest.body) : latest?.message_type === "voice" ? inboxCopy.voice : latest?.message_type === "photo" ? inboxCopy.photo : inboxCopy.noConversation;
  const threadDate = (latest: Row | undefined) => latest?.created_at ? new Date(String(latest.created_at)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "";
  const peopleMode = chatMode === "people";
  const canCompose = peopleMode ? Boolean(chatContact) : Boolean(chatTrip);

  if (view === "chat") return <div className="chat-center">
    <aside className="chat-inbox panel">
      <div className="chat-inbox-heading"><div><small>LOGIPAY CONNECT</small><h2>{peopleMode ? peopleCopy.title : inboxCopy.title}</h2><p>{peopleMode ? peopleCopy.subtitle : inboxCopy.subtitle}</p></div><span>{unreadTrips + unreadPeople}</span></div>
      <div className="chat-inbox-controls">
        <div className="chat-mode-switch"><button type="button" className={peopleMode ? "active" : ""} onClick={() => setChatMode("people")}>{peopleCopy.people}{unreadPeople ? ` (${unreadPeople})` : ""}</button><button type="button" className={!peopleMode ? "active" : ""} onClick={() => setChatMode("trips")}>{peopleCopy.trips}{unreadTrips ? ` (${unreadTrips})` : ""}</button></div>
        <label><span>⌕</span><input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder={peopleMode ? peopleCopy.search : inboxCopy.search} /></label>
        <div><button type="button" className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>{inboxCopy.all}</button><button type="button" className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>{inboxCopy.unread}</button></div>
      </div>
      {peopleMode
        ? <div className="chat-thread-list">{contactRows.length ? contactRows.map(({ contact, latest, unread }) => {
          const key = contactKey(contact);
          return <button key={key} type="button" className={chatContactKey === key ? "chat-thread-active" : ""} onClick={() => setChatContactKey(key)}><span className={`chat-thread-avatar chat-role-${contact.role}`}>{initials(contact.full_name)}</span><span className="chat-thread-copy"><strong>{contact.full_name}</strong><small>{contactSubtitle(contact)}</small><em>{latest || contact.user_id ? String(previewText(latest)).slice(0, 58) : peopleCopy.noLogin}</em></span><span className="chat-thread-meta"><time>{threadDate(latest)}</time>{unread ? <b>{unread}</b> : latest ? <i>✓</i> : null}</span></button>;
        }) : <div className="empty-state">{peopleCopy.empty}</div>}</div>
        : <div className="chat-thread-list">{chatRows.length ? chatRows.map(({ row, latest, unread }) => {
          return <button key={row.id} type="button" className={Number(chatTrip?.id) === Number(row.id) ? "chat-thread-active" : ""} onClick={() => setChatTrip(row)}><span className="chat-thread-avatar">{initials(row.driver_name || row.license_plate || "T")}</span><span className="chat-thread-copy"><strong>{row.driver_name || c.driver}</strong><small>🚚 {row.license_plate || c.noPlate}{row.block_id ? ` · ${row.block_id}` : ""}</small><em>{String(previewText(latest)).slice(0, 58)}</em></span><span className="chat-thread-meta"><time>{threadDate(latest)}</time>{unread ? <b>{unread}</b> : <i>✓</i>}</span></button>;
        }) : <div className="empty-state">{inboxCopy.empty}</div>}</div>}
    </aside>
    <section className="chat-conversation panel">{(peopleMode ? chatContact : chatTrip) ? <>
      {peopleMode && chatContact
        ? <header className="chat-conversation-header"><div className={`chat-thread-avatar chat-role-${chatContact.role}`}>{initials(chatContact.full_name)}</div><div><h2>{chatContact.full_name}</h2><p>{contactSubtitle(chatContact)}{chatContact.role === "driver" && chatContact.company ? ` · ${chatContact.company}` : ""}</p></div><span className="trip-live-status">{roleLabel(chatContact.role)}</span></header>
        : chatTrip ? <header className="chat-conversation-header"><div className="chat-thread-avatar">{initials(chatTrip.driver_name || chatTrip.license_plate || "T")}</div><div><h2>{chatTrip.driver_name || c.driver}</h2><p>🚚 {chatTrip.license_plate || c.noPlate}{chatTrip.block_id ? ` · ${chatTrip.block_id}` : ""}</p></div><span className={`trip-live-status trip-live-${String(chatTrip.status).toLowerCase()}`}>{driver ? c.status[String(chatTrip.status) as keyof typeof c.status] || chatTrip.status : chatTrip.status}</span></header> : null}
      <div className="trip-chat-stream chat-center-stream">{activeMessages.length ? activeMessages.map((message) => {
        const own = Number(message.sender_user_id) === currentUserId;
        return (
          <TripChatMessage
            key={message.id}
            message={message}
            own={own}
            canModerate={chatModerator}
            original={String(message.body || "")}
            copy={chatCopy}
            onDelete={deleteMessage}
            attachmentBase={peopleMode ? "/api/direct-chat" : "/api/trip-chat"}
          />
        );
      }) : <div className="chat-empty-conversation"><span>✉</span><strong>{inboxCopy.noConversation}</strong><small>{c.chatHelp}</small></div>}</div>
      {canCompose ? <form className="trip-chat-composer chat-center-composer" onSubmit={sendChatMessage}>
        {driver ? <div className="request-bar"><b>📦 {requestCopy.title}</b><div>{requestItems.map((item) => <button type="button" key={item.de} onClick={(event) => { const textarea = event.currentTarget.closest("form")?.querySelector("textarea"); if (!textarea) return; textarea.value = `📦 Brauche Lieferung: ${item.de}${locale !== "de" ? ` (${item[locale]})` : ""}. Wohin: `; textarea.focus(); textarea.dispatchEvent(new Event("input", { bubbles: true })); }}>{item[locale]}</button>)}</div></div> : null}
        {recordedBlob ? <div className="composer-chip">🎤 {durationSeconds}s <button type="button" onClick={() => { setRecordedBlob(null); setDurationSeconds(0); }} aria-label="Entfernen">✕</button></div> : null}
        <div className="composer-row">
          <label className="composer-icon" title={c.photo}>📎<input name="file" type="file" accept="image/*,audio/*" /></label>
          <textarea name="body" rows={1} maxLength={2000} placeholder={c.write} onInput={(event) => { const el = event.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <button type="button" className={`composer-icon${recording ? " voice-stop" : ""}`} title={recording ? c.stop : c.record} onClick={recording ? stopRecording : startRecording}>{recording ? "■" : "🎤"}</button>
          <button className="composer-send" title={c.send}>➤</button>
        </div>
        {chatNotice ? <div className="inline-notice">{chatNotice}</div> : null}
        {peopleMode && chatContact && !chatContact.user_id ? <div className="inline-notice">{peopleCopy.noLogin}</div> : null}
      </form> : null}
    </> : <div className="chat-empty-conversation"><span>✉</span><strong>{peopleMode ? peopleCopy.select : inboxCopy.select}</strong></div>}</section>
  </div>;
  return <div className="advanced-stack">
    <div className="trip-board">{rows.length ? rows.map((row) => { const unread = messages.filter((message) => Number(message.trip_operation_id) === Number(row.id) && !Number(message.read_by_me) && Number(message.sender_user_id) !== currentUserId).length; return <article key={row.id} className={`trip-operation trip-status-${String(row.status).toLowerCase()}`}><header><div><strong>{row.license_plate || (driver ? c.noPlate : "Ohne Kennzeichen")}</strong><span>{row.driver_name}{row.block_id ? ` · ${row.block_id}` : ""}</span></div><b>{driver ? c.status[String(row.status) as keyof typeof c.status] || row.status : row.status}</b></header><div className="trip-route"><div><i /><span>{driver ? c.from : "Von"}</span><b>{row.pickup_address || row.location || "—"}</b></div><div><i /><span>{driver ? c.to : "Nach"}</span><b>{row.delivery_address || "—"}</b></div></div><p className="trip-eta"><span>ETA</span>{dateTime(row.eta)}</p>{row.delay_reason ? <div className="trip-problem">{row.delay_reason}</div> : null}<div className="trip-card-actions"><button className="edit-action" onClick={() => setSelected(row)}>{driver ? c.update : "Einsatz bearbeiten"}</button><button className="trip-chat-button" onClick={() => openChat?.(row)}>{c.chat}{unread ? <em>{unread}</em> : null}</button></div></article>; }) : driver ? <div className="empty-state">{c.empty}</div> : <EmptyState icon="➜" title="Noch keine Touren in dieser Woche" hint="Touren entstehen automatisch aus der KW-Planung. Legen Sie dort zuerst einen Einsatz an." />}</div>
    {selected ? <div className="panel"><div className="panel-title"><div><h2>{driver ? c.title : "Einsatz"} {selected.license_plate}</h2><p>{driver ? c.help : "Status, Ziel, ETA, Verzögerung und Zustellbestätigung"}</p></div></div><form className="advanced-form trip-operation-form" onSubmit={submit} key={String(selected.id)}><select name="status" defaultValue={String(selected.status || "Geplant")}>{statuses.map((status) => <option key={status} value={status}>{driver ? c.status[status as keyof typeof c.status] : status}</option>)}</select><input name="pickupAddress" placeholder={driver ? c.pickup : "Ladeadresse"} defaultValue={String(selected.pickup_address || "")} /><input name="deliveryAddress" placeholder={driver ? c.delivery : "Lieferadresse"} defaultValue={String(selected.delivery_address || "")} /><label>ETA<input name="eta" type="datetime-local" defaultValue={String(selected.eta || "").slice(0, 16)} /></label><input name="delayReason" placeholder={driver ? c.delay : "Verspätung / Problem"} defaultValue={String(selected.delay_reason || "")} /><input name="recipientName" placeholder={driver ? c.recipient : "Empfänger"} defaultValue={String(selected.recipient_name || "")} /><input name="signatureName" placeholder={driver ? c.signature : "Unterschrift (Name)"} defaultValue={String(selected.signature_name || "")} /><button className="primary-button">{driver ? c.save : "Einsatz speichern"}</button><button type="button" onClick={() => setSelected(null)}>{driver ? c.close : "Schließen"}</button></form><form className="advanced-form trip-upload-form" onSubmit={upload}><input type="hidden" name="tripOperationId" value={String(selected.id)} /><select name="category" required defaultValue=""><option value="">{driver ? c.docType : "Dokumentart"}</option><option>CMR</option><option>Lieferschein</option><option>Ladung</option><option>Zustellung</option><option>Unterschrift</option><option>Sonstiges</option></select><input name="file" type="file" accept="image/*,application/pdf" capture="environment" required /><button className="primary-button">{driver ? c.upload : "Foto / Dokument hochladen"}</button></form></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>{driver ? c.documents : "CMR & Zustellnachweise"}</h2><p>{driver ? c.docsHelp : "Geschützte Dokumente und Fotos je Einsatz"}</p></div></div><div className="table-wrap"><table><thead><tr><th>{driver ? c.time : "Zeit"}</th><th>{driver ? c.noPlate : "Kennzeichen"}</th><th>{driver ? c.driver : "Fahrer"}</th><th>{driver ? c.kind : "Art"}</th><th>{driver ? c.file : "Datei"}</th></tr></thead><tbody>{documents.length ? documents.map((row) => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td>{row.license_plate || "—"}</td><td>{row.driver_name || "—"}</td><td>{row.category}</td><td><a href={`/api/trip-documents/${row.id}`} target="_blank" rel="noreferrer">{row.file_name}</a></td></tr>) : <tr><td colSpan={5}>{driver ? c.noDocs : "Noch keine Einsatzdokumente"}</td></tr>}</tbody></table></div></div>
  </div>;
}

type ScanResult = { date?: string; grossAmount?: string; vatAmount?: string; licensePlate?: string; documentNumber?: string; merchant?: string; confidence?: number; status?: string };

function approvalDetails(row: Row) {
  try { return JSON.parse(String(row.details || "{}")) as { newValue?: { entityType?: string; decision?: string; comment?: string; responsible?: string } }; }
  catch { return {}; }
}

export function ExpenseCenter({ rows, staff, vehicles, audit, driver, canApprove, locale, action, reload }: { rows: Row[]; staff: Row[]; vehicles: Row[]; audit: Row[]; driver: boolean; canApprove: boolean; locale: DriverLocale; action: Action; reload: () => Promise<void> }) {
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const c = {
    de: { total: "Ausgaben gesamt", open: "Offene Erstattungen", pay: "Zur Zahlung", paid: "Erstattet", fuel: "Kraftstoff", title: "Ausgabe oder privaten Beleg senden", help: "Der Beleg erscheint sofort bei der Buchhaltung", noVehicle: "Ohne Fahrzeug", date: "Datum", category: "Kategorie", privatePay: "Privat bezahlt", companyCard: "Firmenkarte", fuelCard: "Tankkarte", cash: "Firmenkasse / Bar", refund: "Erstattung erforderlich", noRefund: "Keine Erstattung", merchant: "Anbieter / Tankstelle", receiptNo: "Belegnummer", gross: "Brutto €", vat: "MwSt. €", refundAmount: "Erstattung €", liters: "Liter", odometer: "Kilometerstand", customerSite: "Auftraggeber / Standort", block: "Auftrags-Nr.", tour: "Tour-/Auftragsreferenz", cost: "Kostenstelle", note: "Begründung / Notiz", send: "An Buchhaltung senden", sent: "Beleg an Buchhaltung gesendet", my: "Meine Auslagen und Erstattungen", entries: "Einträge", proof: "Prüfung, Auszahlung und Belegnachweis", openReceipt: "Öffnen", empty: "Noch keine Belege" },
    pl: { total: "Wszystkie wydatki", open: "Oczekujące zwroty", pay: "Do wypłaty", paid: "Zwrócono", fuel: "Paliwo", title: "Wyślij wydatek lub prywatny paragon", help: "Paragon od razu trafi do księgowości", noVehicle: "Bez pojazdu", date: "Data", category: "Kategoria", privatePay: "Zapłacono prywatnie", companyCard: "Karta firmowa", fuelCard: "Karta paliwowa", cash: "Kasa firmowa / gotówka", refund: "Zwrot wymagany", noRefund: "Bez zwrotu", merchant: "Sprzedawca / stacja", receiptNo: "Numer paragonu", gross: "Brutto €", vat: "VAT €", refundAmount: "Zwrot €", liters: "Litry", odometer: "Przebieg", customerSite: "Zleceniodawca / lokalizacja", block: "Nr zlecenia", tour: "Numer trasy / zlecenia", cost: "Miejsce kosztów", note: "Uzasadnienie / notatka", send: "Wyślij do księgowości", sent: "Paragon wysłano do księgowości", my: "Moje wydatki i zwroty", entries: "wpisów", proof: "Kontrola, wypłata i dokumenty", openReceipt: "Otwórz", empty: "Brak paragonów" },
    uk: { total: "Усі витрати", open: "Очікують повернення", pay: "До виплати", paid: "Повернуто", fuel: "Пальне", title: "Надіслати витрату або власний чек", help: "Чек одразу з’явиться в бухгалтерії", noVehicle: "Без авто", date: "Дата", category: "Категорія", privatePay: "Сплачено власними коштами", companyCard: "Картка компанії", fuelCard: "Паливна картка", cash: "Каса / готівка", refund: "Потрібне повернення", noRefund: "Без повернення", merchant: "Продавець / АЗС", receiptNo: "Номер чека", gross: "Брутто €", vat: "ПДВ €", refundAmount: "До повернення €", liters: "Літри", odometer: "Пробіг", customerSite: "Замовник / локація", block: "Номер замовлення", tour: "Номер рейсу / замовлення", cost: "Центр витрат", note: "Пояснення / примітка", send: "Надіслати бухгалтерії", sent: "Чек надіслано бухгалтерії", my: "Мої витрати та повернення", entries: "записів", proof: "Перевірка, виплата та підтвердження", openReceipt: "Відкрити", empty: "Чеків ще немає" },
    ru: { total: "Все расходы", open: "Ожидают возврата", pay: "К выплате", paid: "Возвращено", fuel: "Топливо", title: "Отправить расход или личный чек", help: "Чек сразу появится у бухгалтерии", noVehicle: "Без машины", date: "Дата", category: "Категория", privatePay: "Оплачено своими средствами", companyCard: "Карта компании", fuelCard: "Топливная карта", cash: "Касса / наличные", refund: "Нужен возврат", noRefund: "Без возврата", merchant: "Продавец / АЗС", receiptNo: "Номер чека", gross: "Брутто €", vat: "НДС €", refundAmount: "К возврату €", liters: "Литры", odometer: "Пробег", customerSite: "Заказчик / локация", block: "Номер заказа", tour: "Номер рейса / заказа", cost: "Центр затрат", note: "Обоснование / заметка", send: "Отправить бухгалтерии", sent: "Чек отправлен бухгалтерии", my: "Мои расходы и возвраты", entries: "записей", proof: "Проверка, выплата и подтверждение", openReceipt: "Открыть", empty: "Чеков пока нет" },
  }[locale];
  const statuses = ["Eingereicht", "In Prüfung", "Freigegeben", "Zur Zahlung", "Erstattet", "Abgelehnt", "Exportiert"];
  const categories = ["Kraftstoff", "AdBlue", "Maut", "Parken", "Waschanlage", "Reparatur", "Hotel", "Verpflegung", "Taxi", "Büromaterial", "Sonstige Auslage"];
  const categoryLabels: Record<DriverLocale, Record<string, string>> = {
    de: {},
    pl: { Kraftstoff: "Paliwo", Maut: "Opłaty drogowe", Parken: "Parking", Waschanlage: "Myjnia", Reparatur: "Naprawa", Verpflegung: "Wyżywienie", Büromaterial: "Materiały biurowe", "Sonstige Auslage": "Inny wydatek" },
    uk: { Kraftstoff: "Пальне", Maut: "Дорожні збори", Parken: "Паркування", Waschanlage: "Мийка", Reparatur: "Ремонт", Verpflegung: "Харчування", Büromaterial: "Канцелярія", "Sonstige Auslage": "Інша витрата" },
    ru: { Kraftstoff: "Топливо", Maut: "Дорожные сборы", Parken: "Парковка", Waschanlage: "Мойка", Reparatur: "Ремонт", Verpflegung: "Питание", Büromaterial: "Канцелярия", "Sonstige Auslage": "Другой расход" },
  };
  const statusLabels: Record<DriverLocale, Record<string, string>> = {
    de: {},
    pl: { Eingereicht: "Wysłano", "In Prüfung": "W kontroli", Freigegeben: "Zatwierdzono", "Zur Zahlung": "Do wypłaty", Erstattet: "Zwrócono", Abgelehnt: "Odrzucono", Exportiert: "Wyeksportowano" },
    uk: { Eingereicht: "Надіслано", "In Prüfung": "На перевірці", Freigegeben: "Схвалено", "Zur Zahlung": "До виплати", Erstattet: "Повернуто", Abgelehnt: "Відхилено", Exportiert: "Експортовано" },
    ru: { Eingereicht: "Отправлено", "In Prüfung": "На проверке", Freigegeben: "Одобрено", "Zur Zahlung": "К выплате", Erstattet: "Возвращено", Abgelehnt: "Отклонено", Exportiert: "Экспортировано" },
  };
  const filteredRows = useMemo(() => rows.filter((row) => {
    const date = String(row.expense_date || "");
    const needle = search.trim().toLowerCase();
    const haystack = [row.full_name, row.license_plate, row.category, row.merchant, row.amazon_site, row.block_id, row.tour_reference, row.cost_center, row.receipt_number].join(" ").toLowerCase();
    return (!from || date >= from) && (!to || date <= to) && (!statusFilter || row.status === statusFilter) && (!needle || haystack.includes(needle));
  }), [rows, from, to, statusFilter, search]);
  const approvalHistory = useMemo(() => selected ? audit.filter((row) => row.action === "digitalApproval" && String(row.entity_id) === String(selected.id) && approvalDetails(row).newValue?.entityType === "expense") : [], [audit, selected]);

  async function scanDocument(file: File) {
    const formData = new FormData(); formData.set("file", file);
    setNotice(driver ? "Документ распознаётся…" : "Beleg wird erkannt …");
    try {
      const response = await fetch("/api/document-scan", { method: "POST", body: formData });
      const payload = await response.json() as { result?: ScanResult; error?: string };
      if (!response.ok || !payload.result) return setNotice(payload.error || "Dokument konnte nicht gelesen werden");
      setScanResult(payload.result);
      const form = uploadFormRef.current;
      if (form) {
        const setValue = (name: string, value?: string) => { const input = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null; if (input && value) input.value = value; };
        setValue("expenseDate", payload.result.date); setValue("grossAmount", payload.result.grossAmount); setValue("vatAmount", payload.result.vatAmount);
        setValue("receiptNumber", payload.result.documentNumber); setValue("merchant", payload.result.merchant);
        if (payload.result.licensePlate && vehicles.some((vehicle) => vehicle.license_plate === payload.result?.licensePlate)) setValue("licensePlate", payload.result.licensePlate);
      }
      setNotice(`${payload.result.status || "Erkannt"} · ${Math.round(Number(payload.result.confidence || 0) * 100)} %`);
    } catch { setNotice("Erkennung derzeit nicht verfügbar — Felder können manuell ausgefüllt werden."); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const formData = new FormData(form); if (scanResult) formData.set("scanResult", JSON.stringify(scanResult));
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await fetch("/api/expense-receipts", { method: "POST", body: formData });
      const result = await response.json() as { error?: string; recognitionStatus?: string };
      if (!response.ok) return setNotice(result.error || "Upload fehlgeschlagen");
      setNotice(`${driver ? c.sent : "Ausgabe an die Buchhaltung gesendet"} · ${result.recognitionStatus}`); form.reset(); setScanResult(null); await reload();
    } catch {
      await queueOfflineUpload("/api/expense-receipts", formData); form.reset(); setScanResult(null);
      setNotice(driver ? "Чек сохранён без интернета и отправится автоматически." : "Beleg offline gespeichert und wird automatisch synchronisiert.");
    }
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await action({ action: "updateExpenseStatus", id: selected?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setSelected(null);
  }
  async function decide(decision: "Freigeben" | "Ablehnen" | "Zurück zur Korrektur") {
    if (!selected) return;
    await action({ action: "digitalApproval", id: selected.id, entityType: "expense", entityId: selected.id, decision, comment: approvalComment });
    setApprovalComment(""); setSelected(null);
  }
  const counted = filteredRows.filter((row) => row.status !== "Abgelehnt");
  const total = counted.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0);
  const openReimbursement = filteredRows.filter((row) => Number(row.reimbursable) && !["Erstattet", "Abgelehnt", "Exportiert"].includes(String(row.status))).reduce((sum, row) => sum + Number(row.reimbursement_amount || 0), 0);
  const readyToPay = filteredRows.filter((row) => row.status === "Zur Zahlung").reduce((sum, row) => sum + Number(row.reimbursement_amount || 0), 0);
  const reimbursed = filteredRows.filter((row) => row.status === "Erstattet").reduce((sum, row) => sum + Number(row.reimbursement_amount || 0), 0);
  const liters = counted.filter((row) => row.category === "Kraftstoff").reduce((sum, row) => sum + Number(row.liters || 0), 0);
  const reportQuery = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return <div className="advanced-stack">
    <div className="expense-summary"><div><span>{driver ? c.total : "Ausgaben gesamt"}</span><strong>{euro(total)}</strong></div><div><span>{driver ? c.open : "Offene Erstattungen"}</span><strong>{euro(openReimbursement)}</strong></div><div><span>{driver ? c.pay : "Zur Zahlung"}</span><strong>{euro(readyToPay)}</strong></div><div><span>{driver ? c.paid : "Erstattet"}</span><strong>{euro(reimbursed)}</strong></div><div><span>{driver ? c.fuel : "Kraftstoff"}</span><strong>{liters.toLocaleString("de-DE")} l</strong></div></div>
    <div className="panel"><div className="panel-title"><div><h2>{driver ? c.title : "Ausgabe oder Privatauslage erfassen"}</h2><p>{driver ? c.help : "Der Beleg erscheint sofort in der Warteschlange der Buchhaltung"}</p></div></div>
      <form ref={uploadFormRef} className="advanced-form expense-form" onSubmit={upload}>
        {!driver ? <select name="staffId" required defaultValue=""><option value="">Mitarbeiter</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select> : null}
        <select name="licensePlate" defaultValue="OHNE FAHRZEUG"><option value="OHNE FAHRZEUG">{driver ? c.noVehicle : "Ohne Fahrzeug"}</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select>
        <label>{driver ? c.date : "Datum"}<input name="expenseDate" type="date" required /></label>
        <select name="category" required defaultValue=""><option value="">{driver ? c.category : "Kategorie"}</option>{categories.map((item) => <option key={item} value={item}>{driver ? categoryLabels[locale][item] || item : item}</option>)}</select>
        <select name="paymentMethod" required defaultValue="Privatauslage"><option value="Privatauslage">{driver ? c.privatePay : "Privat bezahlt"}</option><option value="Firmenkarte">{driver ? c.companyCard : "Firmenkarte"}</option><option value="Tankkarte">{driver ? c.fuelCard : "Tankkarte"}</option><option value="Bar">{driver ? c.cash : "Firmenkasse / Bar"}</option></select>
        <select name="reimbursable" defaultValue="1"><option value="1">{driver ? c.refund : "Fahrer-Erstattung erforderlich"}</option><option value="0">{driver ? c.noRefund : "Keine Erstattung"}</option></select>
        <input name="merchant" placeholder={driver ? c.merchant : "Anbieter / Tankstelle"} />
        <input name="receiptNumber" placeholder={driver ? c.receiptNo : "Beleg-/Rechnungsnummer"} />
        <input name="grossAmount" type="number" min="0.01" step="0.01" required placeholder={driver ? c.gross : "Brutto €"} />
        <input name="vatAmount" type="number" min="0" step="0.01" placeholder={driver ? c.vat : "MwSt. €"} />
        <input name="reimbursementAmount" type="number" min="0" step="0.01" placeholder={driver ? c.refundAmount : "Erstattung € (sonst Brutto)"} />
        <input name="liters" type="number" min="0" step="0.01" placeholder={driver ? c.liters : "Liter"} />
        <input name="odometerKm" type="number" min="0" step="0.1" placeholder={driver ? c.odometer : "Kilometerstand"} />
        <input name="amazonSite" placeholder={driver ? c.customerSite : "Auftraggeber / Standort"} />
        <input name="blockId" placeholder={driver ? c.block : "Auftrags-Nr."} />
        <input name="tourReference" placeholder={driver ? c.tour : "Tour-/Auftragsreferenz"} />
        <input name="costCenter" placeholder={driver ? c.cost : "Kostenstelle"} />
        <input name="notes" placeholder={driver ? c.note : "Begründung / Notiz"} />
        <label className="scan-file-field"><span>Foto / PDF · automatische Erkennung</span><input name="file" type="file" accept="image/*,application/pdf" capture="environment" required onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanDocument(file); }} /></label>
        <button className="primary-button">{driver ? c.send : "An Buchhaltung senden"}</button>
      </form>{scanResult ? <div className="scan-result-card"><strong>Automatisch erkannt · {Math.round(Number(scanResult.confidence || 0) * 100)} %</strong><span>{[scanResult.date, scanResult.merchant, scanResult.grossAmount && `${scanResult.grossAmount} €`, scanResult.vatAmount && `MwSt. ${scanResult.vatAmount} €`, scanResult.licensePlate, scanResult.documentNumber].filter(Boolean).join(" · ")}</span><small>Bitte erkannte Werte vor dem Senden kurz kontrollieren.</small></div> : null}{notice ? <div className="inline-notice">{notice}</div> : null}<div className="ocr-note"><strong>Dokumentenscan</strong><span>Datum, Betrag, MwSt., Kennzeichen und Belegnummer werden vorbefüllt. Das Original bleibt geschützt gespeichert.</span></div>
    </div>
    {canApprove ? <div className="panel expense-report-panel"><div className="panel-title"><div><h2>Berichte & Nachweise</h2><p>Zeitraum wählen und vollständige Listen für Auftraggeber, Finanzamt oder interne Prüfung exportieren</p></div></div><div className="expense-filter-bar"><label>Von<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Bis<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Alle Status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fahrer, Kennzeichen, Block, Kostenstelle…" /><div className="expense-report-actions"><a href={`/api/reports/expenses?audience=kunde&format=pdf&${reportQuery}`}>Auftraggeber PDF</a><a href={`/api/reports/expenses?audience=kunde&format=csv&${reportQuery}`}>Auftraggeber CSV</a><a href={`/api/reports/expenses?audience=finanzamt&format=pdf&${reportQuery}`}>Finanzamt PDF</a><a href={`/api/reports/expenses?audience=finanzamt&format=csv&${reportQuery}`}>Finanzamt CSV</a></div></div></div> : null}
    {selected && canApprove ? <div className="panel expense-review-panel"><div className="panel-title"><div><h2>Ausgabe #{selected.id} prüfen</h2><p>{selected.full_name} · {selected.expense_date} · {selected.receipt_file_name}</p></div></div><form className="advanced-form expense-review-form" onSubmit={review} key={String(selected.id)}><select name="status" defaultValue={String(selected.status || "In Prüfung")}>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select name="paymentMethod" defaultValue={String(selected.payment_method || "Privatauslage")}><option value="Privatauslage">Privat bezahlt</option><option value="Firmenkarte">Firmenkarte</option><option value="Tankkarte">Tankkarte</option><option value="Bar">Firmenkasse / Bar</option></select><select name="reimbursable" defaultValue={String(selected.reimbursable ?? 1)}><option value="1">Erstattung erforderlich</option><option value="0">Keine Erstattung</option></select><input name="merchant" defaultValue={String(selected.merchant || "")} placeholder="Anbieter" /><input name="grossAmount" type="number" min="0.01" step="0.01" required defaultValue={String(selected.gross_amount || 0)} placeholder="Brutto €" /><input name="vatAmount" type="number" min="0" step="0.01" defaultValue={String(selected.vat_amount || 0)} placeholder="MwSt. €" /><input name="reimbursementAmount" type="number" min="0" step="0.01" defaultValue={String(selected.reimbursement_amount || 0)} placeholder="Erstattung €" /><input name="receiptNumber" defaultValue={String(selected.receipt_number || "")} placeholder="Belegnummer" /><input name="amazonSite" defaultValue={String(selected.amazon_site || "")} placeholder="Amazon Standort" /><input name="blockId" defaultValue={String(selected.block_id || "")} placeholder="Block ID" /><input name="tourReference" defaultValue={String(selected.tour_reference || "")} placeholder="Tourreferenz" /><input name="costCenter" defaultValue={String(selected.cost_center || "")} placeholder="Kostenstelle" /><input name="paymentReference" defaultValue={String(selected.payment_reference || "")} placeholder="Zahlungsreferenz / Überweisung" /><label>Zahlungsdatum<input name="paidAt" type="date" defaultValue={String(selected.paid_at || "").slice(0, 10)} /></label><input name="rejectionReason" defaultValue={String(selected.rejection_reason || "")} placeholder="Ablehnungsgrund" /><input name="notes" defaultValue={String(selected.notes || "")} placeholder="Buchhaltungsnotiz" /><button className="primary-button">Prüfung speichern</button><button type="button" onClick={() => setSelected(null)}>Schließen</button></form><div className="digital-approval"><label>Kommentar zur Entscheidung<textarea value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} placeholder="Begründung oder Hinweis für den Fahrer" /></label><div><button className="approval-accept" type="button" onClick={() => decide("Freigeben")}>✓ Freigeben</button><button className="approval-reject" type="button" onClick={() => decide("Ablehnen")}>× Ablehnen</button><button className="approval-correct" type="button" onClick={() => decide("Zurück zur Korrektur")}>↶ Zurück zur Korrektur</button></div>{approvalHistory.length ? <ol className="approval-history">{approvalHistory.map((row) => { const details = approvalDetails(row).newValue; return <li key={row.id}><b>{details?.decision}</b><span>{details?.responsible || row.user_name} · {dateTime(row.created_at)}</span><small>{details?.comment || "Ohne Kommentar"}</small></li>; })}</ol> : <p className="empty-history">Noch keine Entscheidung protokolliert.</p>}</div></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>{canApprove ? "Buchhaltungs-Warteschlange" : (driver ? c.my : "Meine Auslagen und Erstattungen")}</h2><p>{filteredRows.length} {driver ? c.entries : "Einträge"} · {driver ? c.proof : "Prüfung, Auszahlung und vollständiger Belegnachweis"}</p></div></div>{driver ? <div className="driver-expense-list">{filteredRows.length ? filteredRows.map((row) => <article key={row.id}><div><strong>{categoryLabels[locale][String(row.category)] || row.category}</strong><span>{row.expense_date} · {row.license_plate}</span><small>{row.merchant || row.amazon_site || "—"}</small></div><div><b>{euro(row.gross_amount)}</b><span className="status-pill">{statusLabels[locale][String(row.status)] || row.status}</span>{row.receipt_object_key ? <a href={`/api/expense-receipts/${row.id}`} target="_blank" rel="noreferrer">{c.openReceipt}</a> : null}</div></article>) : <div className="empty-state">{c.empty}</div>}</div> : <div className="table-wrap"><table className="expense-ledger"><thead><tr><th>Datum</th><th>Mitarbeiter</th><th>Kennzeichen</th><th>Auftraggeber / Auftrag</th><th>Kategorie</th><th>Brutto / MwSt.</th><th>Bezahlt mit</th><th>Erstattung</th><th>Status</th><th>Beleg</th>{canApprove ? <th /> : null}</tr></thead><tbody>{filteredRows.length ? filteredRows.map((row) => <tr key={row.id}><td>{row.expense_date}</td><td><strong>{row.full_name}</strong><small>{row.cost_center || "Keine Kostenstelle"}</small></td><td>{row.license_plate}</td><td>{row.amazon_site || "—"}<small>{row.block_id || row.tour_reference || "—"}</small></td><td>{row.category}<small>{row.merchant || "—"}</small></td><td><strong>{euro(row.gross_amount)}</strong><small>MwSt. {euro(row.vat_amount)}</small></td><td>{row.payment_method || "—"}</td><td>{Number(row.reimbursable) ? <strong>{euro(row.reimbursement_amount)}</strong> : "—"}<small>{row.payment_reference || ""}</small></td><td><span className="status-pill">{row.status}</span>{row.paid_at ? <small>{String(row.paid_at).slice(0, 10)}</small> : null}</td><td>{row.receipt_object_key ? <a href={`/api/expense-receipts/${row.id}`} target="_blank" rel="noreferrer">Öffnen</a> : "—"}</td>{canApprove ? <td><button className="edit-action" onClick={() => setSelected(row)}>Prüfen</button></td> : null}</tr>) : <tr><td colSpan={11}><EmptyState icon="€" title="Keine Ausgaben gefunden" hint="Filter ändern – oder Fahrer laden Belege direkt im Portal hoch." /></td></tr>}</tbody></table></div>}</div>
  </div>;
}

export function ChecklistCenter({ rows, staff, vehicles, planning, driver, locale, action }: { rows: Row[]; staff: Row[]; vehicles: Row[]; planning: Row[]; driver: boolean; locale: DriverLocale; action: Action }) {
  const c = {
    de: { title: "Fahrzeugkontrolle", help: "Pflichtcheck vor und nach der Fahrt; Mängel gehen sofort an die Disposition", trip: "Tour (optional)", plate: "Kennzeichen", before: "Vor Fahrt", after: "Nach Fahrt", points: "Alle Punkte bestätigen", damage: "Schaden, fehlende Ausrüstung oder Bemerkung", save: "Kontrolle abschließen", history: "Meine Kontrollen", historyHelp: "Nachweis je Fahrzeug und Zeitpunkt", time: "Zeit", phase: "Phase", defect: "Mangel", empty: "Noch keine Kontrollen", items: ["Feuerlöscher", "Erste-Hilfe-Set", "Warnweste", "Reifen", "Beleuchtung", "Fahrzeugdokumente", "Ladungssicherung", "Sauberkeit"] },
    pl: { title: "Kontrola pojazdu", help: "Kontrola przed i po trasie; usterki od razu trafiają do dyspozytora", trip: "Trasa (opcjonalnie)", plate: "Pojazd", before: "Przed trasą", after: "Po trasie", points: "Potwierdź wszystkie punkty", damage: "Uszkodzenie, brak wyposażenia lub uwaga", save: "Zakończ kontrolę", history: "Moje kontrole", historyHelp: "Historia według pojazdu i czasu", time: "Czas", phase: "Etap", defect: "Usterka", empty: "Brak kontroli", items: ["Gaśnica", "Apteczka", "Kamizelka", "Opony", "Oświetlenie", "Dokumenty pojazdu", "Zabezpieczenie ładunku", "Czystość"] },
    uk: { title: "Перевірка вантажівки", help: "Перевірка до та після рейсу; несправності одразу бачить диспетчер", trip: "Рейс (необов’язково)", plate: "Авто", before: "Перед рейсом", after: "Після рейсу", points: "Підтвердьте всі пункти", damage: "Пошкодження, відсутнє обладнання або примітка", save: "Завершити перевірку", history: "Мої перевірки", historyHelp: "Історія за авто та часом", time: "Час", phase: "Етап", defect: "Несправність", empty: "Перевірок ще немає", items: ["Вогнегасник", "Аптечка", "Жилет", "Шини", "Освітлення", "Документи авто", "Кріплення вантажу", "Чистота"] },
    ru: { title: "Проверка грузовика", help: "Проверка до и после рейса; неисправности сразу видит диспетчер", trip: "Рейс (необязательно)", plate: "Машина", before: "До рейса", after: "После рейса", points: "Подтвердите все пункты", damage: "Повреждение, нет оборудования или заметка", save: "Завершить проверку", history: "Мои проверки", historyHelp: "История по машине и времени", time: "Время", phase: "Этап", defect: "Неисправность", empty: "Проверок пока нет", items: ["Огнетушитель", "Аптечка", "Жилет", "Шины", "Освещение", "Документы машины", "Крепление груза", "Чистота"] },
  }[locale];
  const itemKeys = ["feuerloescher", "ersteHilfe", "warnweste", "reifen", "licht", "dokumente", "ladung", "sauberkeit"];
  const items: Array<[string, string]> = itemKeys.map((key, index) => [key, driver ? c.items[index] : ["Feuerlöscher", "Erste-Hilfe-Set", "Warnweste", "Reifen", "Beleuchtung", "Fahrzeugdokumente", "Ladungssicherung", "Sauberkeit"][index]]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const checks = Object.fromEntries(items.map(([key]) => [key, data.has(key)])); await action({ action: "saveChecklist", staffId: String(data.get("staffId") || ""), planningId: String(data.get("planningId") || ""), licensePlate: String(data.get("licensePlate") || ""), phase: String(data.get("phase") || ""), checksJson: JSON.stringify(checks), damageNotes: String(data.get("damageNotes") || "") }); form.reset(); }
  return <div className="advanced-stack"><div className="panel"><div className="panel-title"><div><h2>{driver ? c.title : "Fahrzeugkontrolle"}</h2><p>{driver ? c.help : "Pflichtcheck vor und nach der Fahrt; Mängel erscheinen sofort bei der Disposition"}</p></div></div><form className="checklist-form" onSubmit={submit}>{!driver ? <select name="staffId" required defaultValue=""><option value="">Fahrer</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select> : null}<select name="planningId" defaultValue=""><option value="">{driver ? c.trip : "Einsatz (optional)"}</option>{planning.map((plan) => <option key={plan.id} value={String(plan.id)}>{plan.driver_name} · {plan.license_plate}</option>)}</select><select name="licensePlate" required defaultValue=""><option value="">{driver ? c.plate : "Kennzeichen"}</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select><select name="phase" required defaultValue="Vor Fahrt"><option value="Vor Fahrt">{driver ? c.before : "Vor Fahrt"}</option><option value="Nach Fahrt">{driver ? c.after : "Nach Fahrt"}</option></select><fieldset><legend>{driver ? c.points : "Kontrollpunkte bestätigen"}</legend><div>{items.map(([key, label]) => <label key={key}><input type="checkbox" name={key} /> <span>{label}</span></label>)}</div></fieldset><textarea name="damageNotes" placeholder={driver ? c.damage : "Schaden, fehlende Ausrüstung oder Bemerkung"} /><button className="primary-button">{driver ? c.save : "Checkliste abschließen"}</button></form></div><div className="panel"><div className="panel-title"><div><h2>{driver ? c.history : "Kontrollhistorie"}</h2><p>{driver ? c.historyHelp : "Nachweis je Fahrer, Fahrzeug und Zeitpunkt"}</p></div></div><div className="table-wrap"><table><thead><tr><th>{driver ? c.time : "Zeit"}</th><th>Fahrer</th><th>{driver ? c.plate : "Kennzeichen"}</th><th>{driver ? c.phase : "Phase"}</th><th>Status</th><th>{driver ? c.defect : "Mangel"}</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td>{row.full_name}</td><td><strong>{row.license_plate}</strong></td><td>{row.phase}</td><td>{row.status === "OK" ? <span className="ok-chip">OK</span> : <span className="danger-chip">{driver ? c.defect : "Mangel"}</span>}</td><td>{row.damage_notes || "—"}</td></tr>) : <tr><td colSpan={6}>{driver ? c.empty : "Noch keine Checklisten"}</td></tr>}</tbody></table></div></div></div>;
}
