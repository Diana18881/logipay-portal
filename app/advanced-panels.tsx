"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DriverLocale } from "./driver-i18n";
import { queueOfflineUpload } from "../lib/offline-client";
import { mapPayrollRows, parseCsv, type PayrollRecord } from "../lib/payroll-import";

type Row = Record<string, string | number | null>;
type Action = (payload: Record<string, string | number | null>) => Promise<void>;

const euro = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const dateText = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("de-DE") : "—";

export function EmployeeDocuments({ rows, staff, audit, driver, locale, action, reload }: { rows: Row[]; staff: Row[]; audit: Row[]; driver: boolean; locale: DriverLocale; action: Action; reload: () => Promise<void> }) {
  const [notice, setNotice] = useState("");
  const [scanResult, setScanResult] = useState<Record<string, string | number | null> | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [renderedAt] = useState(() => new Date().getTime());
  const c = {
    de: { title: "Meine geschützten Dokumente", help: "Führerschein, Fahrerkarte, Aufenthaltstitel und Krankmeldung", type: "Dokumentart", expiry: "Ablaufdatum (optional)", upload: "Sicher hochladen", document: "Dokument", file: "Datei", validTo: "Gültig bis", status: "Status", valid: "Gültig", empty: "Noch keine Dokumente" },
    pl: { title: "Moje chronione dokumenty", help: "Prawo jazdy, karta kierowcy, pobyt i zwolnienia", type: "Rodzaj dokumentu", expiry: "Data ważności (opcjonalnie)", upload: "Wyślij bezpiecznie", document: "Dokument", file: "Plik", validTo: "Ważny do", status: "Status", valid: "Ważny", empty: "Brak dokumentów" },
    uk: { title: "Мої захищені документи", help: "Посвідчення, картка водія, дозвіл на проживання та лікарняні", type: "Тип документа", expiry: "Дійсний до (необов’язково)", upload: "Безпечно завантажити", document: "Документ", file: "Файл", validTo: "Дійсний до", status: "Статус", valid: "Дійсний", empty: "Документів ще немає" },
    ru: { title: "Мои защищённые документы", help: "Права, карта водителя, ВНЖ и больничные", type: "Тип документа", expiry: "Действителен до (необязательно)", upload: "Безопасно загрузить", document: "Документ", file: "Файл", validTo: "Действителен до", status: "Статус", valid: "Действителен", empty: "Документов пока нет" },
  }[locale];
  const documentApprovals = useMemo(() => new Map(rows.map((document) => {
    const event = audit.find((item) => item.action === "digitalApproval" && String(item.entity_id) === String(document.id) && String(item.details || "").includes('"entityType":"employee_document"'));
    if (!event) return [String(document.id), null];
    try { return [String(document.id), { ...JSON.parse(String(event.details || "{}")).newValue, at: event.created_at }]; } catch { return [String(document.id), null]; }
  })), [audit, rows]);

  async function scan(file: File) {
    const formData = new FormData(); formData.set("file", file);
    setNotice("Dokument wird automatisch erkannt …");
    try {
      const response = await fetch("/api/document-scan", { method: "POST", body: formData });
      const payload = await response.json() as { result?: Record<string, string | number | null>; error?: string };
      if (!response.ok || !payload.result) return setNotice(payload.error || "Erkennung fehlgeschlagen");
      setScanResult(payload.result); setNotice(`${payload.result.status || "Erkannt"} · ${Math.round(Number(payload.result.confidence || 0) * 100)} %`);
    } catch { setNotice("Dokument kann weiter manuell hochgeladen werden."); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form); if (scanResult) formData.set("scanResult", JSON.stringify(scanResult));
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await fetch("/api/employee-documents", { method: "POST", body: formData });
      const result = await response.json() as { error?: string };
      if (!response.ok) return setNotice(result.error || "Upload fehlgeschlagen");
      form.reset(); setScanResult(null); setNotice("Dokument sicher gespeichert"); await reload();
    } catch {
      await queueOfflineUpload("/api/employee-documents", formData); form.reset(); setScanResult(null); setNotice("Offline gespeichert — Upload folgt automatisch.");
    }
  }
  async function decide(decision: "Freigeben" | "Ablehnen" | "Zurück zur Korrektur") {
    if (!selected) return;
    await action({ action: "digitalApproval", id: selected.id, entityType: "employee_document", entityId: selected.id, decision, comment: approvalComment });
    setApprovalComment(""); setSelected(null);
  }
  const expiry = (value: unknown) => {
    if (!value) return "";
    const days = Math.ceil((new Date(String(value)).getTime() - renderedAt) / 86400000);
    return days < 0 ? "Abgelaufen" : days <= 60 ? `Nur noch ${days} Tage` : "";
  };
  return <section className="advanced-stack">
    <div className="panel">
      <div className="panel-title"><div><h2>{driver ? c.title : "Digitale Personalakte"}</h2><p>{driver ? c.help : "Arbeitsvertrag, Führerschein, Fahrerkarte, Aufenthaltstitel und Krankmeldung"}</p></div></div>
      <form ref={formRef} className="advanced-form" onSubmit={upload}>
        {!driver ? <select name="staffId" required defaultValue=""><option value="">Mitarbeiter wählen</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select> : null}
        <select name="category" required defaultValue=""><option value="">{driver ? c.type : "Dokumentart"}</option>{(driver ? ["Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung"] : ["Arbeitsvertrag", "Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung", "Lohnabrechnung", "Sonstiges"]).map((category) => <option key={category}>{category}</option>)}</select>
        <label>{driver ? c.expiry : "Ablaufdatum (optional)"}<input name="expiresAt" type="date" /></label>
        <input name="file" type="file" accept="application/pdf,image/*" required onChange={(event) => { const file = event.target.files?.[0]; if (file) void scan(file); }} />
        <button className="primary-button">{driver ? c.upload : "Sicher hochladen"}</button>
      </form>
      {scanResult ? <div className="scan-result-card"><strong>Dokument erkannt · {Math.round(Number(scanResult.confidence || 0) * 100)} %</strong><span>{[scanResult.date, scanResult.documentNumber, scanResult.licensePlate, scanResult.merchant].filter(Boolean).join(" · ") || "Metadaten werden im Prüfprotokoll gespeichert"}</span></div> : null}
      {notice ? <div className="inline-notice">{notice}</div> : null}
      <div className="table-wrap"><table><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>{driver ? c.document : "Dokument"}</th><th>{driver ? c.file : "Datei"}</th><th>{driver ? c.validTo : "Gültig bis"}</th><th>{driver ? c.status : "Status"}</th><th>Freigabe</th><th>Upload</th></tr></thead><tbody>{rows.length ? rows.map((row) => { const approval = documentApprovals.get(String(row.id)) as { decision?: string } | null; return <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td><strong>{row.category}</strong></td><td><a href={`/api/employee-documents/${row.id}`} target="_blank" rel="noreferrer">{row.file_name}</a></td><td>{dateText(row.expires_at)}</td><td>{expiry(row.expires_at) ? <span className="danger-chip">{expiry(row.expires_at)}</span> : <span className="ok-chip">{driver ? c.valid : "Gültig"}</span>}</td><td>{approval?.decision ? <span className="status-pill">{approval.decision}</span> : (!driver ? <button className="edit-action" type="button" onClick={() => setSelected(row)}>Prüfen</button> : "Offen")}</td><td>{dateText(row.created_at)}</td></tr>; }) : <tr><td colSpan={7}>{driver ? c.empty : "Noch keine Dokumente"}</td></tr>}</tbody></table></div>
      {selected && !driver ? <div className="digital-approval document-approval"><h3>{selected.category} · {selected.full_name}</h3><textarea value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} placeholder="Kommentar zur Freigabe" /><div><button className="approval-accept" type="button" onClick={() => decide("Freigeben")}>✓ Freigeben</button><button className="approval-reject" type="button" onClick={() => decide("Ablehnen")}>× Ablehnen</button><button className="approval-correct" type="button" onClick={() => decide("Zurück zur Korrektur")}>↶ Korrektur</button><button type="button" onClick={() => setSelected(null)}>Schließen</button></div></div> : null}
    </div>
  </section>;
}

export function PayrollCenter({ rows, periods, workDays, staff, driver, management, locale, action, reload }: { rows: Row[]; periods: Row[]; workDays: Row[]; staff: Row[]; driver: boolean; management: boolean; locale: DriverLocale; action: Action; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [reopenReason, setReopenReason] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcDone, setCalcDone] = useState("");
  const c = {
    de: { title: "Meine Abrechnung", help: "Monatliche Lohnwerte, Zahlungsstatus und PDF", month: "Monat", base: "Grundgehalt", tours: "Arbeitstage", night: "Nacht", sunday: "Sonntag", holiday: "Feiertag", expenses: "Spesen", reimbursements: "Erstattungen", deductions: "Abzüge", net: "Netto", status: "Status", empty: "Noch keine Monatsabrechnung" },
    pl: { title: "Moje rozliczenie", help: "Miesięczne wynagrodzenie, status płatności i PDF", month: "Miesiąc", base: "Podstawa", tours: "Dni pracy", night: "Noc", sunday: "Niedziela", holiday: "Święta", expenses: "Diety", reimbursements: "Zwroty", deductions: "Potrącenia", net: "Netto", status: "Status", empty: "Brak rozliczenia" },
    uk: { title: "Мій розрахунок", help: "Місячна зарплата, статус виплати та PDF", month: "Місяць", base: "Основна зарплата", tours: "Робочі дні", night: "Нічні", sunday: "Неділя", holiday: "Свята", expenses: "Добові", reimbursements: "Повернення витрат", deductions: "Відрахування", net: "Нетто", status: "Статус", empty: "Розрахунку ще немає" },
    ru: { title: "Мой расчёт", help: "Месячная зарплата, статус выплаты и PDF", month: "Месяц", base: "Основная зарплата", tours: "Рабочие дни", night: "Ночные", sunday: "Воскресенье", holiday: "Праздники", expenses: "Суточные", reimbursements: "Возврат расходов", deductions: "Удержания", net: "Нетто", status: "Статус", empty: "Расчёта пока нет" },
  }[locale];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await action({ action: "savePayroll", id: selected?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setSelected(null); form.reset();
  }
  const periodRow = periods.find((row) => row.period === period);
  const isClosed = periodRow?.status === "closed";
  const monthRows = rows.filter((row) => row.period === period);
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find((row) => row.id === selected.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(selected)) setSelected(fresh);
  }, [rows, selected]);
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setCalcBusy(true); setCalcDone("");
    await action({ action: "calculatePayrollPeriod", ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setCalcBusy(false); setCalcDone(`Berechnung für ${String(values.period)} abgeschlossen – Ergebnis unten.`);
    setTimeout(() => document.getElementById("payroll-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }
  async function reopen() {
    await action({ action: "reopenPayrollPeriod", period, reason: reopenReason }); setReopenReason("");
  }
  return <div className="advanced-stack payroll-workspace">
    {!driver ? <WorkTimeSheet staff={staff} workDays={workDays} period={period} setPeriod={setPeriod} closed={periods.some((item) => item.period === period && item.status === "closed")} action={action} /> : null}
    {!driver ? <div className="panel payroll-automation"><div className="panel-title"><div><h2>2 · Abrechnung berechnen</h2><p>Grundlage sind die tatsächlichen Arbeitstage aus der Wochenplanung (nur Tage im gewählten Monat, Tour gestartet oder abgeschlossen). Pro Arbeitstag: Spesen; dazu Zuschläge für Nachtschicht, Sonntag und Feiertag und freigegebene Erstattungen. Das Grundgehalt kommt aus „Vergütung“ im Mitarbeiterstamm: „1750 € Netto“ = Monatsbetrag, „14 €/h“ = Stundenlohn × Stunden × Arbeitstage, „90 €/Tag“ = Tagessatz × Arbeitstage. Abzüge (Vorschuss, Bußgeld, Schaden) trägst du je Monat unten ein; Brutto-Vergütungen werden ohne Steuern und Sozialabgaben ausgewiesen.</p></div><span className={`period-state state-${String(periodRow?.status || "open")}`}>{periodRow?.status === "closed" ? "Geschlossen" : periodRow?.status === "review" ? "In Prüfung" : "Offen"}</span></div><form className="payroll-auto-form" onSubmit={calculate}>
      <label>Abrechnungsmonat<input name="period" type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label>Spesen je Arbeitstag €<input name="spesenRate" type="number" min="0" step="0.01" defaultValue="14" /></label>
      <label>Nachtzuschlag je Nachtschicht €<input name="nightRate" type="number" min="0" step="0.01" defaultValue="25" /></label>
      <label>Sonntagszuschlag je Tag €<input name="sundayRate" type="number" min="0" step="0.01" defaultValue="50" /></label>
      <label>Feiertagszuschlag je Tag €<input name="holidayRate" type="number" min="0" step="0.01" defaultValue="100" /></label>
      <label>Stunden je Arbeitstag<input name="hoursPerDay" type="number" min="1" max="24" step="0.5" defaultValue="8" /></label>
      <label className="payroll-check"><input name="countPlanned" type="checkbox" defaultChecked /> Geplante Tage ohne Tourstart mitzählen</label>
      <label className="payroll-check"><input name="overwriteManual" type="checkbox" /> Manuell korrigierte Abrechnungen neu berechnen</label>
      <button className="primary-button" disabled={isClosed || calcBusy}>{calcBusy ? "Wird berechnet …" : "Automatisch berechnen"}</button>
    </form>{calcDone ? <div className="inline-notice" style={{ margin: "0 20px 12px" }}>{calcDone}</div> : null}<div className="payroll-period-actions"><span>Beim „Monat schließen“ wird die Abrechnung gesperrt und jeder Mitarbeiter automatisch benachrichtigt („Ihr Lohn ist bereit“).</span>{!isClosed ? <><button onClick={() => action({ action: "setPayrollPeriodStatus", period, status: "review" })}>Zur Prüfung</button><button className="close-period-button" onClick={() => action({ action: "setPayrollPeriodStatus", period, status: "closed" })}>Monat schließen</button></> : management ? <><input value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Begründung für Wiederöffnung" /><button className="reopen-period-button" disabled={reopenReason.trim().length < 5} onClick={reopen}>Mit Management-Freigabe öffnen</button></> : <strong>Nur Management kann diesen Monat wieder öffnen.</strong>}</div>{periodRow?.closed_at ? <div className="period-audit">Geschlossen am {dateText(periodRow.closed_at)} von {periodRow.closed_by_name || "Buchhaltung"}{periodRow.reopen_reason ? ` · Letzte Wiederöffnung: ${periodRow.reopen_reason}` : ""}</div> : null}</div> : null}
    {!driver ? <div className="panel" id="payroll-results"><div className="panel-title"><div><h2>3 · Abrechnungen {period}</h2><p>{monthRows.length ? `${monthRows.length} Mitarbeiter · Summe Netto ${euro(monthRows.reduce((sum, row) => sum + Number(row.net_amount || 0), 0))}` : "Für diesen Monat gibt es noch keine Abrechnung. Oben automatisch berechnen oder eine Datei übernehmen."}</p></div>{monthRows.length ? <a className="primary-button" href={`/api/payroll/period/${period}`} target="_blank" rel="noreferrer">Alle Lohnzettel (PDF)</a> : null}</div>
      {monthRows.length && monthRows.every((row) => !Number(row.tour_count)) ? <div className="inline-notice" style={{ margin: "0 20px 12px" }}>Keine Arbeitstage gefunden: In {period} gibt es keine passende Wochenplanung (oder keine gestartete Tour). Prüfen Sie den Monat und die KW-Planung; „Geplante Tage mitzählen“ muss angehakt sein.</div> : null}
      {monthRows.length ? <div className="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Grundgehalt</th><th>Arbeitstage</th><th>Spesen</th><th>Zuschläge</th><th>Erstattung</th><th>Abzüge</th><th>Auszahlung</th><th>Status</th><th /></tr></thead><tbody>
        {monthRows.map((row) => <tr key={row.id} className={selected?.id === row.id ? "payroll-row-editing" : undefined}><td><strong>{row.full_name}</strong>{String(row.calculation_details || "").includes('"source":"manual-adjustment"') ? <small className="manual-badge" title="Von Hand korrigiert – wird beim automatischen Berechnen nicht überschrieben">✎ manuell</small> : null}</td><td>{euro(row.base_salary)}</td><td>{row.tour_count}</td><td>{euro(row.expenses)}</td><td>{euro(Number(row.night_bonus || 0) + Number(row.sunday_bonus || 0) + Number(row.holiday_bonus || 0))}</td><td>{euro(row.reimbursements)}</td><td>{euro(row.deductions)}</td><td><strong>{euro(row.net_amount)}</strong></td><td><span className="status-pill">{row.payment_status}</span></td><td><a href={`/api/payroll/${row.id}/pdf`} target="_blank">PDF ↓</a>{!isClosed ? <> <button className="edit-action" onClick={() => { setSelected(row); setTimeout(() => document.getElementById("payroll-edit")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>Bearbeiten</button></> : null}</td></tr>)}
      </tbody></table></div> : null}
    </div> : null}
    {!driver ? <PayrollFileImport staff={staff} period={period} reload={reload} /> : null}
    {!driver ? <div className="panel" id="payroll-edit"><div className="panel-title"><div><h2>Abrechnung prüfen und korrigieren</h2><p>Automatische Werte können vor dem Monatsabschluss nachvollziehbar angepasst werden.</p></div></div><form className="payroll-form" onSubmit={submit} key={`${String(selected?.id || "new")}-${String(selected?.updated_at || selected?.calculated_at || "")}`}>
      <select name="staffId" required defaultValue={String(selected?.staff_id || "")}><option value="">Mitarbeiter</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select>
      <label>Monat<input name="period" type="month" required defaultValue={String(selected?.period || new Date().toISOString().slice(0, 7))} /></label>
      <label>Grundgehalt<input name="baseSalary" type="number" step="0.01" min="0" defaultValue={String(selected?.base_salary || 0)} /></label>
      <label>Arbeitstage<input name="tourCount" type="number" min="0" defaultValue={String(selected?.tour_count || 0)} /></label>
      <label>Spesen<input name="expenses" type="number" step="0.01" defaultValue={String(selected?.expenses || 0)} /></label>
      <label>Nachtzuschläge<input name="nightBonus" type="number" step="0.01" defaultValue={String(selected?.night_bonus || 0)} /></label>
      <label>Sonntagszuschläge<input name="sundayBonus" type="number" step="0.01" defaultValue={String(selected?.sunday_bonus || 0)} /></label>
      <label>Feiertagszuschläge<input name="holidayBonus" type="number" step="0.01" defaultValue={String(selected?.holiday_bonus || 0)} /></label>
      <label>Erstattungen<input name="reimbursements" type="number" step="0.01" defaultValue={String(selected?.reimbursements || 0)} /></label>
      <label>Abzüge<input name="deductions" type="number" step="0.01" defaultValue={String(selected?.deductions || 0)} /></label>
      <label>Zahlungsstatus<select name="paymentStatus" defaultValue={String(selected?.payment_status || "draft")}><option value="draft">Entwurf</option><option value="review">Prüfung</option><option value="approved">Freigegeben</option><option value="paid">Bezahlt</option></select></label>
      <button className="primary-button">Abrechnung speichern</button>{selected ? <button type="button" onClick={() => setSelected(null)}>Abbrechen</button> : null}
    </form></div> : null}
    {driver ? <div className="panel"><div className="panel-title"><div><h2>{c.title}</h2><p>{c.help}</p></div></div><div className="table-wrap"><table className="payroll-ledger"><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>{driver ? c.month : "Monat"}</th><th>{driver ? c.base : "Grundgehalt"}</th><th>{driver ? c.tours : "Touren"}</th><th>{c.expenses}</th><th>{c.night}</th><th>{c.sunday}</th><th>{c.holiday}</th><th>{c.reimbursements}</th><th>{c.deductions}</th><th>{c.net}</th><th>{c.status}</th><th>PDF</th>{!driver ? <th /> : null}</tr></thead><tbody>{rows.length ? rows.map((row) => { const closed = periods.some((item) => item.period === row.period && item.status === "closed"); return <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td><strong>{row.period}</strong>{closed ? <small className="locked-note">🔒 geschlossen</small> : null}</td><td>{euro(row.base_salary)}</td><td>{row.tour_count}</td><td>{euro(row.expenses)}</td><td>{euro(row.night_bonus)}</td><td>{euro(row.sunday_bonus)}</td><td>{euro(row.holiday_bonus)}</td><td>{euro(row.reimbursements)}</td><td>{euro(row.deductions)}</td><td><strong>{euro(row.net_amount)}</strong></td><td><span className="status-pill">{row.payment_status}</span></td><td><a href={`/api/payroll/${row.id}/pdf`} target="_blank">PDF ↓</a></td>{!driver ? <td>{closed ? <span className="locked-note">Gesperrt</span> : <button className="edit-action" onClick={() => setSelected(row)}>Bearbeiten</button>}</td> : null}</tr>; }) : <tr><td colSpan={14}>{driver ? c.empty : "Noch keine Monatsabrechnung"}</td></tr>}</tbody></table></div></div> : null}
  </div>;
}

const monthDays = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1));
    return { key: date.toISOString().slice(0, 10), day: index + 1, weekday: (date.getUTCDay() + 6) % 7 };
  });
};
type DayEntry = { type: "work" | "vacation" | "sick"; hours: number; night: boolean };
// Same federal holidays the payroll calculation uses for the holiday bonus.
const federalHoliday = (key: string) => {
  const year = Number(key.slice(0, 4));
  if (["01-01", "05-01", "10-03", "12-25", "12-26"].includes(key.slice(5))) return true;
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easter = Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  const day = Date.parse(`${key}T00:00:00Z`);
  return [-2, 1, 39, 50].some((offset) => day === easter + offset * 86400000);
};
const dayLabels: Record<DayEntry["type"], string> = { work: "Arbeit", vacation: "Urlaub", sick: "Krank" };

function WorkTimeSheet({ staff, workDays, period, setPeriod, closed, action }: { staff: Row[]; workDays: Row[]; period: string; setPeriod: (value: string) => void; closed: boolean; action: Action }) {
  const [staffId, setStaffId] = useState(String(staff[0]?.id || ""));
  const [days, setDays] = useState<Record<string, DayEntry>>({});
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [busy, setBusy] = useState(false);
  const stored = useMemo(() => workDays.filter((row) => String(row.staff_id) === staffId && String(row.work_date).startsWith(period)), [workDays, staffId, period]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(Object.fromEntries(stored.map((row) => [String(row.work_date), { type: String(row.day_type) as DayEntry["type"], hours: Number(row.hours), night: Boolean(Number(row.night)) }])));
  }, [stored]);
  const calendar = monthDays(period);
  const storedDays = useMemo(() => Object.fromEntries(stored.map((row) => [String(row.work_date), { type: String(row.day_type), hours: Number(row.hours), night: Boolean(Number(row.night)) }])), [stored]);
  const dirty = JSON.stringify(Object.entries(days).sort()) !== JSON.stringify(Object.entries(storedDays).sort());
  const leaveUnsaved = () => !dirty || window.confirm("Änderungen für diesen Mitarbeiter sind nicht gespeichert. Trotzdem wechseln?");
  const summary = { work: 0, hours: 0, vacation: 0, sick: 0 };
  for (const entry of Object.values(days)) { if (entry.type === "work") { summary.work += 1; summary.hours += Number(entry.hours || 0); } else summary[entry.type] += 1; }
  const perStaff = (id: unknown) => {
    const list = workDays.filter((row) => String(row.staff_id) === String(id) && String(row.work_date).startsWith(period));
    return { days: list.filter((row) => row.day_type === "work").length, hours: list.reduce((sum, row) => sum + (row.day_type === "work" ? Number(row.hours || 0) : 0), 0) };
  };
  function cycle(key: string) {
    if (closed) return;
    setDays((current) => {
      const next = { ...current }; const entry = next[key];
      if (!entry) next[key] = { type: "work", hours: Number(hoursPerDay) || 8, night: false };
      else if (entry.type === "work") next[key] = { ...entry, type: "vacation" };
      else if (entry.type === "vacation") next[key] = { ...entry, type: "sick" };
      else delete next[key];
      return next;
    });
  }
  function patch(key: string, change: Partial<DayEntry>) { setDays((current) => current[key] ? { ...current, [key]: { ...current[key], ...change } } : current); }
  function weekdays() {
    setDays((current) => ({ ...current, ...Object.fromEntries(calendar.filter((item) => item.weekday < 5 && !current[item.key]).map((item) => [item.key, { type: "work" as const, hours: Number(hoursPerDay) || 8, night: false }])) }));
  }
  async function save() {
    if (!staffId) return;
    setBusy(true);
    await action({ action: "saveWorkDays", staffId, period, days: Object.entries(days).map(([date, entry]) => ({ date, ...entry })) } as never);
    setBusy(false);
  }
  async function fillFromPlan() {
    setBusy(true);
    await action({ action: "fillWorkDaysFromPlan", period, hoursPerDay });
    setBusy(false);
  }
  const person = staff.find((item) => String(item.id) === staffId);
  return <div className="panel timesheet">
    <div className="panel-title"><div><h2>1 · Arbeitszeit erfassen</h2><p>Wie in der Lohnbuchhaltung: pro Mitarbeiter und Monat die Arbeitstage eintragen. Tag anklicken: Arbeit → Urlaub → Krank → leer. Danach unter „2 · Berechnen“ die Abrechnung erstellen.</p></div></div>
    <div className="timesheet-controls">
      <label>Monat<input type="month" value={period} onChange={(event) => { if (leaveUnsaved()) setPeriod(event.target.value); }} /></label>
      <label>Stunden je Arbeitstag<input type="number" min="1" max="24" step="0.5" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} /></label>
      <button type="button" disabled={busy || closed} onClick={fillFromPlan}>Aus KW-Planung übernehmen (alle)</button>
      {closed ? <span className="locked-note">🔒 Monat geschlossen</span> : null}
    </div>
    <div className="timesheet-layout">
      <aside className="timesheet-people">{staff.map((item) => { const info = perStaff(item.id); return <button type="button" key={String(item.id)} className={String(item.id) === staffId ? "active" : ""} onClick={() => { if (String(item.id) !== staffId && leaveUnsaved()) setStaffId(String(item.id)); }}><b>{String(item.full_name)}</b><small>{info.days ? `${info.days} Tage · ${info.hours} h` : "nicht erfasst"}</small></button>; })}</aside>
      <div className="timesheet-main">
        <div className="timesheet-head"><strong>{person ? String(person.full_name) : "—"}</strong><span>{person?.compensation ? `Vergütung: ${String(person.compensation)}` : "Keine Vergütung im Mitarbeiterstamm hinterlegt"}</span></div>
        <div className="timesheet-grid">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((name) => <em key={name}>{name}</em>)}
          {Array.from({ length: calendar[0].weekday }, (_, index) => <i key={`pad-${index}`} />)}
          {calendar.map((item) => { const entry = days[item.key]; return <div key={item.key} className={`ts-day${entry ? ` ts-${entry.type}` : ""}${item.weekday === 6 ? " ts-sunday" : ""}${federalHoliday(item.key) ? " ts-holiday" : ""}`} title={federalHoliday(item.key) ? "Gesetzlicher Feiertag – Feiertagszuschlag" : undefined}>
            <button type="button" onClick={() => cycle(item.key)}><b>{item.day}</b><span>{entry ? dayLabels[entry.type] : ""}</span></button>
            {entry?.type === "work" ? <div className="ts-extra"><input type="number" min="0" max="24" step="0.5" value={entry.hours} onChange={(event) => patch(item.key, { hours: Number(event.target.value) })} aria-label="Stunden" /><label title="Nachtschicht"><input type="checkbox" checked={entry.night} onChange={(event) => patch(item.key, { night: event.target.checked })} />🌙</label></div> : null}
          </div>; })}
        </div>
        <div className="timesheet-footer"><span><b>{summary.work}</b> Arbeitstage</span><span><b>{summary.hours}</b> Stunden</span><span><b>{summary.vacation}</b> Urlaub</span><span><b>{summary.sick}</b> Krank</span>
          <div>{dirty ? <span className="ts-unsaved">● Nicht gespeichert</span> : null}<button type="button" onClick={weekdays} disabled={closed}>Mo–Fr eintragen</button><button type="button" onClick={() => setDays({})} disabled={closed}>Leeren</button><button type="button" className="primary-button" disabled={busy || closed} onClick={save}>Speichern</button></div></div>
      </div>
    </div>
  </div>;
}

function PayrollFileImport({ staff, period, reload }: { staff: Row[]; period: string; reload: () => Promise<void> }) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const known = useMemo(() => new Set(staff.map((person) => String(person.full_name).trim().toLowerCase().replace(/\s+/g, " "))), [staff]);
  const isKnown = (record: PayrollRecord) => known.has(record.name.trim().toLowerCase().replace(/\s+/g, " "));
  async function readFile(file: File) {
    setBusy(true); setMessage(""); setProblems([]); setRecords([]); setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let found: PayrollRecord[] = [];
      if (lower.endsWith(".xlsx")) {
        const { default: readWorkbook } = await import("read-excel-file/browser");
        const workbook = await readWorkbook(file) as { sheet: string; data: unknown[][] }[];
        for (const sheet of workbook) {
          const matrix = sheet.data.filter((row) => row.some((cell) => String(cell ?? "").trim()));
          const headerIndex = matrix.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
          if (headerIndex < 0) continue;
          const headers = matrix[headerIndex].map((cell, index) => String(cell ?? "").trim() || `Spalte ${index + 1}`);
          const parsed = matrix.slice(headerIndex + 1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
          found = found.concat(mapPayrollRows(parsed, period));
        }
      } else if (lower.endsWith(".csv")) {
        found = mapPayrollRows(parseCsv(await file.text()), period);
      } else if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        const form = new FormData(); form.set("file", file); form.set("period", period);
        const response = await fetch("/api/payroll-import", { method: "POST", body: form });
        const result = await response.json() as { records?: PayrollRecord[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Datei konnte nicht gelesen werden");
        found = result.records || [];
      } else throw new Error("Unterstützt: Excel (.xlsx), CSV, PDF oder Foto");
      if (!found.length) throw new Error("Keine Mitarbeiter-Zeilen erkannt. Die Datei braucht Spalten wie Name, Grundgehalt, Spesen, Netto.");
      setRecords(found);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fehler beim Lesen"); }
    setBusy(false);
  }
  async function commit() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/payroll-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: records.filter(isKnown) }) });
    const result = await response.json() as { imported?: number; problems?: string[]; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Import fehlgeschlagen");
    setMessage(`${result.imported} Abrechnungen übernommen.`); setProblems(result.problems || []); setRecords([]); setFileName(""); await reload();
  }
  const matched = records.filter(isKnown).length;
  return <div className="panel payroll-import">
    <div className="panel-title"><div><h2>Abrechnung aus Datei übernehmen</h2><p>Datei hochladen – Mitarbeiter, Beträge und Monat werden automatisch erkannt und ins Portal übertragen.</p></div></div>
    <label className={`import-dropzone${dragging ? " import-dropzone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}>
      <span>⇪</span><strong>{busy ? "Wird verarbeitet …" : fileName || "Datei hierher ziehen oder auswählen"}</strong><small>Excel · CSV · PDF · Foto</small>
      <input type="file" accept=".xlsx,.csv,application/pdf,image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
    </label>
    {message ? <div className="inline-notice">{message}</div> : null}
    {records.length ? <>
      <div className="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Monat</th><th>Grundgehalt</th><th>Arbeitstage</th><th>Zuschläge</th><th>Spesen</th><th>Erstattung</th><th>Abzüge</th><th>Netto</th><th /></tr></thead><tbody>
        {records.map((record, index) => <tr key={index}><td><strong>{record.name}</strong></td><td>{record.period}</td><td>{euro(record.baseSalary)}</td><td>{record.tourCount}</td><td>{euro(record.nightBonus + record.sundayBonus + record.holidayBonus)}</td><td>{euro(record.expenses)}</td><td>{euro(record.reimbursements)}</td><td>{euro(record.deductions)}</td><td><strong>{euro(record.netAmount)}</strong></td><td>{isKnown(record) ? <span className="ok-chip">Zugeordnet</span> : <span className="danger-chip">Unbekannt</span>}</td></tr>)}
      </tbody></table></div>
      <div className="import-toolbar"><button className="primary-button" disabled={busy || !matched} onClick={commit}>{matched} Abrechnungen übernehmen</button><button type="button" onClick={() => { setRecords([]); setFileName(""); }}>Verwerfen</button>{matched < records.length ? <span className="locked-note">{records.length - matched} Zeilen ohne passenden Mitarbeiter werden übersprungen.</span> : null}</div>
    </> : null}
    {problems.length ? <ul className="import-problems">{problems.map((item) => <li key={item}>{item}</li>)}</ul> : null}
  </div>;
}

export function MaintenanceCenter({ rows, vehicles, canEdit, action }: { rows: Row[]; vehicles: Row[]; canEdit: boolean; action: Action }) {
  const [editing, setEditing] = useState<Row | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    await action({ action: editing ? "updateMaintenance" : "addMaintenance", id: editing?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setEditing(null); form.reset();
  }
  return <div className="panel maintenance-panel"><div className="panel-title"><div><h2>Wartung & Schadensverlauf</h2><p>TÜV/HU/SP, Versicherung, Reparatur, Kosten und Freigabe</p></div></div>{canEdit ? <form className="advanced-form" onSubmit={submit} key={String(editing?.id || "new")}>
    <select name="licensePlate" required defaultValue={String(editing?.license_plate || "")} disabled={Boolean(editing)}><option value="">Kennzeichen</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select>
    <select name="category" defaultValue={String(editing?.category || "Wartung")}><option>Wartung</option><option>Schaden</option><option>TÜV / HU / SP</option><option>Versicherung</option><option>Reifen</option></select>
    <input name="description" required placeholder="Beschreibung" defaultValue={String(editing?.description || "")} />
    <input name="responsible" placeholder="Verantwortlich / Werkstatt" defaultValue={String(editing?.responsible || "")} />
    <label>Termin<input name="dueDate" type="date" defaultValue={String(editing?.due_date || "")} /></label>
    <label>Kosten €<input name="cost" type="number" step="0.01" min="0" defaultValue={String(editing?.cost || 0)} /></label>
    <select name="status" defaultValue={String(editing?.status || "Gemeldet")}><option>Gemeldet</option><option>Werkstatt</option><option>Repariert</option><option>Freigegeben</option></select>
    <button className="primary-button">{editing ? "Änderung speichern" : "Vorgang anlegen"}</button>{editing ? <button type="button" onClick={() => setEditing(null)}>Abbrechen</button> : null}
  </form> : null}<div className="table-wrap"><table><thead><tr><th>Kennzeichen</th><th>Kategorie</th><th>Beschreibung</th><th>Verantwortlich</th><th>Termin</th><th>Kosten</th><th>Status</th>{canEdit ? <th /> : null}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{row.license_plate}</strong></td><td>{row.category}</td><td>{row.description}</td><td>{row.responsible || "—"}</td><td>{dateText(row.due_date)}</td><td>{euro(row.cost)}</td><td><span className="status-pill">{row.status}</span></td>{canEdit ? <td><button className="edit-action" onClick={() => setEditing(row)}>Bearbeiten</button></td> : null}</tr>) : <tr><td colSpan={8}>Keine Wartungsvorgänge</td></tr>}</tbody></table></div></div>;
}

const auditLabels: Record<string, string> = {
  savePayroll: "Abrechnung gespeichert", calculatePayrollPeriod: "Monat berechnet", setPayrollPeriodStatus: "Abrechnungsmonat Status geändert", reopenPayrollPeriod: "Abrechnungsmonat wieder geöffnet",
  saveWorkDays: "Arbeitszeit gespeichert", fillWorkDaysFromPlan: "Arbeitszeit aus Planung übernommen", payrollFileImport: "Lohn aus Datei importiert", downloadPayrollPdf: "Lohnzettel geöffnet", downloadPayrollBulkPdf: "Alle Lohnzettel geöffnet",
  addAbsence: "Abwesenheit eingetragen", deleteAbsence: "Abwesenheit gelöscht", addDriverPerformance: "Fahrerbewertung / Ereignis", createStaffForm: "Personaldokument (PDF) erstellt", backupExport: "Backup heruntergeladen",
  saveStaff: "Mitarbeiter gespeichert", archiveStaff: "Mitarbeiter ausgeschieden", restoreStaff: "Mitarbeiter reaktiviert", deleteStaff: "Mitarbeiter gelöscht", saveVehicle: "Fahrzeug gespeichert", updateVehicle: "Fahrzeug geändert",
  savePlanning: "Planung gespeichert", updatePlanning: "Planung geändert", deletePlanning: "Planung gelöscht", saveTripOperation: "Tourstatus geändert", sendTripMessage: "Chat-Nachricht gesendet", deleteTripMessage: "Chat-Nachricht gelöscht", sendDirectMessage: "Direktnachricht gesendet", deleteDirectMessage: "Direktnachricht gelöscht", markDirectMessagesRead: "Direktnachrichten gelesen",
};
const humanAction = (action: unknown) => auditLabels[String(action)] || String(action).replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

function ChangeLog({ audit }: { audit: Row[] }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const rows = audit.filter((row) => `${humanAction(row.action)} ${row.user_name || row.full_name || ""} ${row.entity_id || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="panel"><div className="panel-title"><div><h2>Änderungsprotokoll</h2><p>Wer hat wann was geändert – die letzten Einträge zuerst</p></div><input className="month-input" placeholder="Suchen …" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="changelog">{rows.slice(0, limit).map((row) => <article key={String(row.id)}><time>{String(row.created_at).slice(0, 16).replace("T", " ")}</time><div><b>{humanAction(row.action)}</b><small>{String(row.user_name || row.full_name || row.user_email || `Benutzer ${row.user_id ?? "—"}`)}{row.entity_id ? ` · Objekt ${row.entity_id}` : ""}</small></div></article>)}
      {!rows.length ? <div className="empty-state">Keine Einträge gefunden</div> : null}
      {rows.length > limit ? <button type="button" className="sort-toggle" onClick={() => setLimit(limit + 50)}>Mehr anzeigen ({rows.length - limit})</button> : null}
    </div></div>;
}

export function SecurityCenter({ loginAudit, resetRequests, audit, action }: { loginAudit: Row[]; resetRequests: Row[]; audit: Row[]; action: Action }) {
  function backup() { window.open("/api/admin/backup", "_blank"); }
  return <div className="advanced-stack"><div className="security-grid"><div className="security-card"><strong>2FA geschützt</strong><span>Management und Buchhaltung bestätigen den Login mit einem Einmalcode.</span></div><div className="security-card"><strong>5 Fehlversuche</strong><span>Danach wird der Zugang automatisch 15 Minuten gesperrt.</span></div><div className="security-card"><strong>DSGVO-Export</strong><span>Personalbezogene Daten sind je Mitarbeiter exportierbar.</span></div><button className="security-card security-action" onClick={backup}><strong>⬇ Alle Daten herunterladen</strong><span>Komplette Sicherung (Mitarbeiter, Touren, Lohn, Abwesenheiten …) als Datei speichern – am besten einmal pro Woche.</span></button></div>
    {resetRequests.length ? <div className="panel"><div className="panel-title"><div><h2>Offene Passwortanfragen</h2><p>Neuen Startcode im Mitarbeiterprofil vergeben und Anfrage schließen</p></div></div><div className="table-wrap"><table><thead><tr><th>Email</th><th>Anfrage</th><th /></tr></thead><tbody>{resetRequests.map((row) => <tr key={row.id}><td>{row.email}</td><td>{dateText(row.created_at)}</td><td><button className="edit-action" onClick={() => action({ action: "resolveResetRequest", id: row.id })}>Als erledigt markieren</button></td></tr>)}</tbody></table></div></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>Login-Journal</h2><p>Erfolgreiche und fehlgeschlagene Anmeldeversuche</p></div></div><div className="table-wrap"><table><thead><tr><th>Zeit</th><th>Email</th><th>Ergebnis</th><th>IP</th></tr></thead><tbody>{loginAudit.map((row) => <tr key={row.id}><td>{String(row.created_at).slice(0, 16).replace("T", " ")}</td><td>{row.email}</td><td>{Number(row.success) ? <span className="ok-chip">Erfolgreich</span> : <span className="danger-chip">Fehlgeschlagen</span>}</td><td>{row.ip_address || "—"}</td></tr>)}</tbody></table></div></div>
    <ChangeLog audit={audit} />
  </div>;
}

function trackerStatus(row: Row, clock: number) {
  if (!row.recorded_at) return { label: "Kein Signal", tone: "offline" };
  const ageMinutes = (clock - new Date(String(row.recorded_at)).getTime()) / 60_000;
  if (ageMinutes > 30) return { label: "Offline", tone: "offline" };
  if (Number(row.speed_kph || 0) > 90) return { label: "Tempoalarm", tone: "alert" };
  if (Number(row.speed_kph || 0) > 3) return { label: "In Fahrt", tone: "moving" };
  return { label: "Steht", tone: "online" };
}

export function TruckTracking({ rows, vehicles, operations, canManage, locale, action }: { rows: Row[]; vehicles: Row[]; operations: Row[]; canManage: boolean; locale: DriverLocale; action: Action }) {
  const [selectedPlate, setSelectedPlate] = useState("");
  const [history, setHistory] = useState<Row[]>([]);
  const [clock, setClock] = useState(() => new Date().getTime());
  const [trackerProvider, setTrackerProvider] = useState("Fleetboard");
  const [fleetboardStatus, setFleetboardStatus] = useState<{
    bridgeConfigured: boolean;
    mappedVehicles: number;
    reportingVehicles: number;
    lastSyncAt: string | null;
    ingestPath: string;
  } | null>(null);
  const [fleetboardNotice, setFleetboardNotice] = useState("");
  const [integrationKey, setIntegrationKey] = useState("");
  const driverView = !canManage;
  const c = {
    de: { moving: "In Fahrt", alarms: "Alarme", fleet: "Mein Fahrzeug", refresh: "Aktualisierung alle 15 Sek.", unknown: "Position unbekannt", noTracker: "Noch kein Fahrzeug-Tracker verbunden.", noSignal: "kein Signal", lastSignal: "letztes Signal vor", minutes: "Min.", noPosition: "Noch keine GPS-Position vorhanden.", speed: "Geschwindigkeit", ignition: "Zündung", on: "Ein", off: "Aus", odometer: "Kilometerstand", coordinates: "Koordinaten", source: "Datenquelle", history: "Positionsverlauf", historyHelp: "Die letzten Meldungen des Fahrzeugs" },
    pl: { moving: "W trasie", alarms: "Alarmy", fleet: "Mój pojazd", refresh: "Odświeżanie co 15 sek.", unknown: "Pozycja nieznana", noTracker: "Brak połączonego trackera.", noSignal: "brak sygnału", lastSignal: "ostatni sygnał", minutes: "min temu", noPosition: "Brak pozycji GPS.", speed: "Prędkość", ignition: "Zapłon", on: "Wł.", off: "Wył.", odometer: "Przebieg", coordinates: "Współrzędne", source: "Źródło danych", history: "Historia pozycji", historyHelp: "Ostatnie pozycje pojazdu" },
    uk: { moving: "У русі", alarms: "Тривоги", fleet: "Моє авто", refresh: "Оновлення кожні 15 сек.", unknown: "Місце невідоме", noTracker: "Трекер авто ще не підключено.", noSignal: "немає сигналу", lastSignal: "останній сигнал", minutes: "хв. тому", noPosition: "GPS-позиції ще немає.", speed: "Швидкість", ignition: "Запалювання", on: "Увімк.", off: "Вимк.", odometer: "Пробіг", coordinates: "Координати", source: "Джерело даних", history: "Історія позицій", historyHelp: "Останні позиції авто" },
    ru: { moving: "В движении", alarms: "Тревоги", fleet: "Моя машина", refresh: "Обновление каждые 15 сек.", unknown: "Местоположение неизвестно", noTracker: "Трекер машины пока не подключён.", noSignal: "нет сигнала", lastSignal: "последний сигнал", minutes: "мин. назад", noPosition: "GPS-позиции пока нет.", speed: "Скорость", ignition: "Зажигание", on: "Вкл.", off: "Выкл.", odometer: "Пробег", coordinates: "Координаты", source: "Источник данных", history: "История позиций", historyHelp: "Последние позиции машины" },
  }[locale];
  const activePlate = selectedPlate || String(rows[0]?.license_plate || "");
  const selected = rows.find((row) => String(row.license_plate) === activePlate) || rows[0];
  const selectedRecordedAt = selected?.recorded_at;

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date().getTime()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!activePlate) return;
    fetch(`/api/tracking/history?plate=${encodeURIComponent(activePlate)}&limit=100`)
      .then((response) => response.json() as Promise<{ rows?: Row[] }>)
      .then((result) => { if (!cancelled) setHistory(result.rows || []); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [activePlate, selectedRecordedAt]);
  async function refreshFleetboardStatus() {
    if (!canManage) return;
    try {
      const response = await fetch("/api/tracking/fleetboard/status", { cache: "no-store" });
      const result = await response.json() as typeof fleetboardStatus & { error?: string };
      if (!response.ok || !result) return setFleetboardNotice(result?.error || "Fleetboard-Status konnte nicht geladen werden");
      setFleetboardStatus(result); setFleetboardNotice("");
    } catch { setFleetboardNotice("Fleetboard-Status konnte nicht geladen werden"); }
  }
  async function createIntegrationKey() {
    if (fleetboardStatus?.bridgeConfigured && !window.confirm("Der bisherige Schlüssel funktioniert danach nicht mehr. Fortfahren?")) return;
    const response = await fetch("/api/company/integration-key", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { key?: string; error?: string };
    if (!response.ok || !result.key) return setFleetboardNotice(result.error || "Schlüssel konnte nicht erzeugt werden");
    setIntegrationKey(result.key);
    await refreshFleetboardStatus();
  }
  useEffect(() => {
    let cancelled = false;
    if (!canManage) return;
    fetch("/api/tracking/fleetboard/status", { cache: "no-store" })
      .then((response) => response.json().then((result) => ({ ok: response.ok, result })))
      .then(({ ok, result }) => {
        if (cancelled) return;
        if (!ok) setFleetboardNotice(String(result?.error || "Fleetboard-Status konnte nicht geladen werden"));
        else { setFleetboardStatus(result); setFleetboardNotice(""); }
      })
      .catch(() => { if (!cancelled) setFleetboardNotice("Fleetboard-Status konnte nicht geladen werden"); });
    return () => { cancelled = true; };
  }, [canManage, selectedRecordedAt]);

  const summary = useMemo(() => rows.reduce((result, row) => {
    const status = trackerStatus(row, clock);
    result.total += 1;
    if (status.tone === "offline") result.offline += 1;
    else result.online += 1;
    if (status.tone === "moving" || status.tone === "alert") result.moving += 1;
    if (status.tone === "alert") result.alerts += 1;
    return result;
  }, { total: 0, online: 0, moving: 0, offline: 0, alerts: 0 }), [rows, clock]);

  async function saveTracker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await action({ action: "saveTracker", licensePlate: String(values.licensePlate || ""), provider: String(values.provider || ""), deviceId: String(values.deviceId || "") });
    form.reset(); setTrackerProvider("Fleetboard"); await refreshFleetboardStatus();
  }
  async function addManualPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    await action({
      action: "addManualPosition",
      licensePlate: String(values.licensePlate || ""),
      latitude: String(values.latitude || ""),
      longitude: String(values.longitude || ""),
      speedKph: String(values.speedKph || "0"),
      heading: String(values.heading || ""),
      odometerKm: String(values.odometerKm || ""),
      ignition: formData.has("ignition") ? "true" : "false",
      address: String(values.address || ""),
    });
    form.reset();
  }

  const latitude = selected?.latitude == null ? null : Number(selected.latitude);
  const longitude = selected?.longitude == null ? null : Number(selected.longitude);
  const hasPosition = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const status = selected ? trackerStatus(selected, clock) : { label: "Kein Signal", tone: "offline" };
  const signalAge = selected?.recorded_at ? Math.max(0, Math.floor((clock - new Date(String(selected.recorded_at)).getTime()) / 60_000)) : null;
  const mapPoints = useMemo(() => {
    const points = [...history.slice(0, 50).reverse(), ...rows].filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)));
    if (!points.length) return [] as Array<{ row: Row; x: number; y: number }>;
    const lats = points.map((row) => Number(row.latitude)); const lngs = points.map((row) => Number(row.longitude));
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const latRange = Math.max(maxLat - minLat, 0.01); const lngRange = Math.max(maxLng - minLng, 0.01);
    return points.map((row) => ({ row, x: 7 + ((Number(row.longitude) - minLng) / lngRange) * 86, y: 93 - ((Number(row.latitude) - minLat) / latRange) * 86 }));
  }, [history, rows]);
  const trailPoints = mapPoints.slice(0, Math.min(history.length, 50));
  const trailSegments = trailPoints.slice(1).map((point, index) => {
    const previous = trailPoints[index]; const dx = point.x - previous.x; const dy = point.y - previous.y;
    return { left: previous.x, top: previous.y, width: Math.sqrt(dx * dx + dy * dy), angle: Math.atan2(dy, dx) * 180 / Math.PI };
  });
  const activeOperation = operations.find((row) => String(row.license_plate) === activePlate && !["Zugestellt", "Geplant"].includes(String(row.status))) || operations.find((row) => String(row.license_plate) === activePlate);
  const stops = trailPoints.filter((point) => Number(point.row.speed_kph || 0) <= 3).length;

  return <div className="advanced-stack tracking-page">
    <div className="tracking-summary">
      <div><span>Tracker</span><strong>{summary.total}</strong></div>
      <div><span>Online</span><strong>{summary.online}</strong></div>
      <div><span>{driverView ? c.moving : "In Fahrt"}</span><strong>{summary.moving}</strong></div>
      <div className={summary.offline ? "tracking-warning" : ""}><span>Offline</span><strong>{summary.offline}</strong></div>
      <div className={summary.alerts ? "tracking-danger" : ""}><span>{driverView ? c.alarms : "Alarme"}</span><strong>{summary.alerts}</strong></div>
    </div>

    <div className="tracking-layout">
      <aside className="tracker-list" aria-label="Fahrzeuge mit Tracker">
        <div className="tracker-list-title"><strong>{driverView ? c.fleet : "Fahrzeugflotte"}</strong><small>{driverView ? c.refresh : "Aktualisierung alle 15 Sek."}</small></div>
        {rows.length ? rows.map((row) => {
          const itemStatus = trackerStatus(row, clock);
          return <button key={row.id} className={`tracker-card ${String(row.license_plate) === activePlate ? "tracker-card-active" : ""}`} onClick={() => setSelectedPlate(String(row.license_plate))}>
            <span className={`tracker-dot tracker-${itemStatus.tone}`} />
            <span><strong>{row.license_plate}</strong><small>{row.address || row.provider || (driverView ? c.unknown : "Position unbekannt")}</small></span>
            <span className="tracker-card-state"><b>{Math.round(Number(row.speed_kph || 0))} km/h</b><small>{itemStatus.label}</small></span>
          </button>;
        }) : <div className="empty-state">{driverView ? c.noTracker : "Noch kein Fahrzeug-Tracker verbunden."}</div>}
      </aside>

      <section className="tracker-map-panel">
        <div className="tracker-map-heading">
          <div><span className={`tracker-dot tracker-${status.tone}`} /><div><h2>{selected?.license_plate || "Live-Tracking"}</h2><p>{status.label} · {signalAge == null ? (driverView ? c.noSignal : "kein Signal") : `${driverView ? c.lastSignal : "letztes Signal vor"} ${signalAge} ${driverView ? c.minutes : "Min."}`}</p></div></div>
          <div className="map-live-metrics"><span><b>{Math.round(Number(selected?.speed_kph || 0))}</b> km/h</span><span><b>{stops}</b> Stopps</span><span><b>{activeOperation?.eta ? dateText(activeOperation.eta) : "—"}</b> ETA</span></div>
        </div>
        <div className="tracker-private-map">
          <div className="tracker-grid-lines" />
          <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
          {trailSegments.map((segment, index) => <i key={index} className="map-trail" style={{ left: `${segment.left}%`, top: `${segment.top}%`, width: `${segment.width}%`, transform: `rotate(${segment.angle}deg)` }} />)}
          {trailPoints.filter((point) => Number(point.row.speed_kph || 0) <= 3).slice(-8).map((point, index) => <span key={`stop-${index}`} className="map-stop" style={{ left: `${point.x}%`, top: `${point.y}%` }} title="Stopp" />)}
          {mapPoints.slice(Math.min(history.length, 50)).map((point) => { const pointStatus = trackerStatus(point.row, clock); return <button key={`fleet-${point.row.id}`} type="button" className={`map-fleet-marker tracker-${pointStatus.tone} ${String(point.row.license_plate) === activePlate ? "map-fleet-active" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => setSelectedPlate(String(point.row.license_plate))}><span>▰</span><b>{point.row.license_plate}</b></button>; })}
          {hasPosition && !mapPoints.length ? <div className={`truck-marker tracker-${status.tone}`}><span>▰</span><strong>{selected?.license_plate}</strong></div> : !hasPosition ? <div className="empty-state">{driverView ? c.noPosition : "Noch keine GPS-Position vorhanden."}</div> : null}
          <div className="tracker-location-label"><strong>{selected?.address || "GPS-Position"}</strong><span>{hasPosition ? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}` : "—"}</span></div>
          <div className={`map-signal-badge ${status.tone === "offline" ? "signal-lost" : ""}`}>{status.tone === "offline" ? "GPS-Signal verloren" : "GPS live"}</div>
        </div>
        {selected ? <div className="tracking-detail-grid">
          <div><span>{driverView ? c.speed : "Geschwindigkeit"}</span><strong>{Math.round(Number(selected.speed_kph || 0))} km/h</strong></div>
          <div><span>{driverView ? c.ignition : "Zündung"}</span><strong>{Number(selected.ignition) ? (driverView ? c.on : "Ein") : (driverView ? c.off : "Aus")}</strong></div>
          <div><span>{driverView ? c.odometer : "Kilometerstand"}</span><strong>{selected.odometer_km == null ? "—" : `${Number(selected.odometer_km).toLocaleString("de-DE")} km`}</strong></div>
          <div><span>Tracker</span><strong>{selected.provider} · {selected.device_id}</strong></div>
          <div><span>{driverView ? c.coordinates : "Koordinaten"}</span><strong>{hasPosition ? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}` : "—"}</strong></div>
          <div><span>{driverView ? c.source : "Datenquelle"}</span><strong>{selected.source === "demo" ? "Demo (nicht live)" : selected.source === "manual" ? "Manuell" : selected.source === "fleetboard" ? "Fleetboard Live" : "GPS-Tracker"}</strong></div>
        </div> : null}
        {selected?.source === "demo" ? <div className="tracking-demo-note">Demo-Koordinaten: Für echte Live-Daten bitte den eingebauten Tracker oder Telematik-Anbieter verbinden.</div> : null}
      </section>
    </div>

    <div className="panel">
      <div className="panel-title"><div><h2>{driverView ? c.history : "Positionsverlauf"}</h2><p>{driverView ? c.historyHelp : "Die letzten 100 Meldungen des ausgewählten Fahrzeugs"}</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Zeit</th><th>Ort</th><th>Geschwindigkeit</th><th>Zündung</th><th>Koordinaten</th><th>Quelle</th></tr></thead><tbody>{history.length ? history.map((row, index) => <tr key={`${row.recorded_at}-${index}`}><td>{String(row.recorded_at).slice(0, 16).replace("T", " ")}</td><td>{row.address || "—"}</td><td>{Math.round(Number(row.speed_kph || 0))} km/h</td><td>{Number(row.ignition) ? "Ein" : "Aus"}</td><td>{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</td><td>{row.source === "demo" ? "Demo" : row.source === "manual" ? "Manuell" : row.source === "fleetboard" ? "Fleetboard" : "Tracker"}</td></tr>) : <tr><td colSpan={6}>Noch keine Positionshistorie</td></tr>}</tbody></table></div>
    </div>

    {canManage ? <div className="tracking-config-grid">
      <div className="panel fleetboard-connect-panel">
        <div className="fleetboard-connect-head">
          <div className="fleetboard-wordmark"><span>FB</span><div><strong>Fleetboard Live GPS</strong><small>Mapping / Track & Trace · sichere Server-Verbindung</small></div></div>
          <span className={`fleetboard-state ${fleetboardStatus?.lastSyncAt ? "fleetboard-live" : fleetboardStatus?.bridgeConfigured ? "fleetboard-ready" : "fleetboard-setup"}`}>
            {fleetboardStatus?.lastSyncAt ? "● Live-Daten aktiv" : fleetboardStatus?.bridgeConfigured ? "Bereit zur Fahrzeugzuordnung" : "Einrichtung erforderlich"}
          </span>
        </div>
        <div className="fleetboard-kpis">
          <div><span>Zugeordnet</span><strong>{fleetboardStatus?.mappedVehicles ?? "—"}</strong><small>Fleetboard Fahrzeuge</small></div>
          <div><span>Mit Signal</span><strong>{fleetboardStatus?.reportingVehicles ?? "—"}</strong><small>mindestens einmal verbunden</small></div>
          <div><span>Letzte Synchronisierung</span><strong>{fleetboardStatus?.lastSyncAt ? new Date(fleetboardStatus.lastSyncAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Noch kein Signal"}</strong><small>automatisch über GPS</small></div>
        </div>
        <div className="fleetboard-capabilities"><span>Position</span><span>Geschwindigkeit</span><span>Stopps</span><span>Zündung</span><span>Kilometerstand</span><span>ETA</span></div>
        <div className="fleetboard-security-state"><span className={fleetboardStatus?.bridgeConfigured ? "is-ready" : "is-missing"}>Schnittstellenschlüssel {fleetboardStatus?.bridgeConfigured ? "aktiv" : "noch nicht erzeugt"}</span></div>
        <div className="fleetboard-setup-steps">
          <div><b>1</b><span>Fleetboard SOAP-API-Benutzer im Portal anlegen und Mapping / Track & Trace buchen.</span></div>
          <div><b>2</b><span>Unten Kennzeichen und Fleetboard Fahrzeug-ID oder VIN eindeutig zuordnen.</span></div>
          <div><b>3</b><span>Schnittstellenschlüssel erzeugen und beim Telematik-Anbieter als Bearer-Token eintragen. Der Schlüssel wird nur einmal angezeigt.</span></div>
        </div>
        <div className="fleetboard-connector-line"><code>{fleetboardStatus?.ingestPath || "/api/tracking/fleetboard/ingest"}</code><button type="button" onClick={() => void refreshFleetboardStatus()}>Verbindung prüfen</button><button type="button" onClick={() => void createIntegrationKey()}>{fleetboardStatus?.bridgeConfigured ? "Neuen Schlüssel erzeugen" : "Schlüssel erzeugen"}</button></div>
        {integrationKey ? <div className="inline-notice integration-key"><span>Nur jetzt sichtbar – sicher speichern:</span><code>{integrationKey}</code></div> : null}
        {fleetboardNotice ? <div className="inline-notice">{fleetboardNotice}</div> : null}
      </div>
      <div className="panel">
        <div className="panel-title"><div><h2>Tracker verbinden</h2><p>Geräte-ID eindeutig einem Kennzeichen zuordnen</p></div></div>
        <form className="advanced-form tracking-form" onSubmit={saveTracker}>
          <select name="licensePlate" required defaultValue=""><option value="">Kennzeichen wählen</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select>
          <select name="provider" value={trackerProvider} onChange={(event) => setTrackerProvider(event.target.value)}><option>Fleetboard</option><option>Webfleet</option><option>Samsara</option><option>Geotab</option><option>Verizon Connect</option><option>Fleet Complete</option><option>Andere</option></select>
          <input name="deviceId" required placeholder={trackerProvider === "Fleetboard" ? "Fleetboard Fahrzeug-ID / VIN" : "Geräte-ID / IMEI"} />
          <button className="primary-button">Tracker speichern</button>
        </form>
        <div className="tracking-api-note"><strong>{trackerProvider === "Fleetboard" ? "Fleetboard SOAP + LOGIPAY Bridge" : "Geschützte Schnittstelle"}</strong><span>{trackerProvider === "Fleetboard" ? <>Fleetboard-Daten werden serverseitig normalisiert und an <code>/api/tracking/fleetboard/ingest</code> übertragen.</> : <>Der Anbieter sendet Daten an <code>/api/tracking/ingest</code>.</>} Der geheime Zugriffsschlüssel wird nur auf dem Server gespeichert.</span></div>
      </div>
      <div className="panel">
        <div className="panel-title"><div><h2>Testposition erfassen</h2><p>Nur für Einrichtung oder als manueller Fallback</p></div></div>
        <form className="advanced-form tracking-form" onSubmit={addManualPosition}>
          <select name="licensePlate" required defaultValue=""><option value="">Kennzeichen wählen</option>{rows.map((row) => <option key={row.id}>{row.license_plate}</option>)}</select>
          <input name="latitude" type="number" min="-90" max="90" step="0.000001" required placeholder="Breitengrad" />
          <input name="longitude" type="number" min="-180" max="180" step="0.000001" required placeholder="Längengрад" />
          <input name="speedKph" type="number" min="0" max="250" step="0.1" placeholder="km/h" />
          <input name="heading" type="number" min="0" max="359.9" step="0.1" placeholder="Richtung 0–359°" />
          <input name="odometerKm" type="number" min="0" step="0.1" placeholder="Kilometerstand" />
          <input name="address" placeholder="Ort / Adresse (optional)" />
          <label className="tracking-check"><input name="ignition" type="checkbox" /> Zündung ein</label>
          <button className="primary-button">Testposition speichern</button>
        </form>
      </div>
    </div> : null}
  </div>;
}

export function PasswordChange({ required, done }: { required: boolean; done: () => void }) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); if (data.get("newPassword") !== data.get("confirmPassword")) return setError("Passwörter stimmen nicht überein"); const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }); const result = await response.json() as { error?: string }; if (!response.ok) return setError(result.error || "Fehler beim Speichern"); done(); }
  return <div className={required ? "password-overlay" : "password-inline"}><form className="password-change-card" onSubmit={submit}><span className="secure-label"><i /> Sicherheit</span><h2>{required ? "Startpasswort muss geändert werden" : "Passwort ändern"}</h2><p>Mindestens 10 Zeichen, Großbuchstabe und Zahl.</p><label>Aktuelles Passwort<input name="currentPassword" type="password" required /></label><label>Neues Passwort<input name="newPassword" type="password" minLength={10} required /></label><label>Passwort wiederholen<input name="confirmPassword" type="password" minLength={10} required /></label>{error ? <div className="login-error">{error}</div> : null}<button className="primary-button">Sicher speichern</button></form></div>;
}
