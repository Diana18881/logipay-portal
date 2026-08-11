"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DriverLocale } from "./driver-i18n";

type Row = Record<string, string | number | null>;
type Action = (payload: Record<string, string | number | null>) => Promise<void>;

const euro = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const dateText = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("de-DE") : "—";

export function EmployeeDocuments({ rows, staff, driver, locale, reload }: { rows: Row[]; staff: Row[]; driver: boolean; locale: DriverLocale; reload: () => Promise<void> }) {
  const [notice, setNotice] = useState("");
  const [renderedAt] = useState(() => new Date().getTime());
  const c = {
    de: { title: "Meine geschützten Dokumente", help: "Führerschein, Fahrerkarte, Aufenthaltstitel und Krankmeldung", type: "Dokumentart", expiry: "Ablaufdatum (optional)", upload: "Sicher hochladen", document: "Dokument", file: "Datei", validTo: "Gültig bis", status: "Status", valid: "Gültig", empty: "Noch keine Dokumente" },
    pl: { title: "Moje chronione dokumenty", help: "Prawo jazdy, karta kierowcy, pobyt i zwolnienia", type: "Rodzaj dokumentu", expiry: "Data ważności (opcjonalnie)", upload: "Wyślij bezpiecznie", document: "Dokument", file: "Plik", validTo: "Ważny do", status: "Status", valid: "Ważny", empty: "Brak dokumentów" },
    uk: { title: "Мої захищені документи", help: "Посвідчення, картка водія, дозвіл на проживання та лікарняні", type: "Тип документа", expiry: "Дійсний до (необов’язково)", upload: "Безпечно завантажити", document: "Документ", file: "Файл", validTo: "Дійсний до", status: "Статус", valid: "Дійсний", empty: "Документів ще немає" },
    ru: { title: "Мои защищённые документы", help: "Права, карта водителя, ВНЖ и больничные", type: "Тип документа", expiry: "Действителен до (необязательно)", upload: "Безопасно загрузить", document: "Документ", file: "Файл", validTo: "Действителен до", status: "Статус", valid: "Действителен", empty: "Документов пока нет" },
  }[locale];
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/employee-documents", { method: "POST", body: new FormData(form) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error || "Upload fehlgeschlagen");
    form.reset(); setNotice("Dokument sicher gespeichert"); await reload();
  }
  const expiry = (value: unknown) => {
    if (!value) return "";
    const days = Math.ceil((new Date(String(value)).getTime() - renderedAt) / 86400000);
    return days < 0 ? "Abgelaufen" : days <= 60 ? `Nur noch ${days} Tage` : "";
  };
  return <section className="advanced-stack">
    <div className="panel">
      <div className="panel-title"><div><h2>{driver ? c.title : "Digitale Personalakte"}</h2><p>{driver ? c.help : "Arbeitsvertrag, Führerschein, Fahrerkarte, Aufenthaltstitel und Krankmeldung"}</p></div></div>
      <form className="advanced-form" onSubmit={upload}>
        {!driver ? <select name="staffId" required defaultValue=""><option value="">Mitarbeiter wählen</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select> : null}
        <select name="category" required defaultValue=""><option value="">{driver ? c.type : "Dokumentart"}</option>{(driver ? ["Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung"] : ["Arbeitsvertrag", "Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung", "Lohnabrechnung", "Sonstiges"]).map((category) => <option key={category}>{category}</option>)}</select>
        <label>{driver ? c.expiry : "Ablaufdatum (optional)"}<input name="expiresAt" type="date" /></label>
        <input name="file" type="file" accept="application/pdf,image/*" required />
        <button className="primary-button">{driver ? c.upload : "Sicher hochladen"}</button>
      </form>
      {notice ? <div className="inline-notice">{notice}</div> : null}
      <div className="table-wrap"><table><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>{driver ? c.document : "Dokument"}</th><th>{driver ? c.file : "Datei"}</th><th>{driver ? c.validTo : "Gültig bis"}</th><th>{driver ? c.status : "Status"}</th><th>Upload</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td><strong>{row.category}</strong></td><td><a href={`/api/employee-documents/${row.id}`} target="_blank" rel="noreferrer">{row.file_name}</a></td><td>{dateText(row.expires_at)}</td><td>{expiry(row.expires_at) ? <span className="danger-chip">{expiry(row.expires_at)}</span> : <span className="ok-chip">{driver ? c.valid : "Gültig"}</span>}</td><td>{dateText(row.created_at)}</td></tr>) : <tr><td colSpan={6}>{driver ? c.empty : "Noch keine Dokumente"}</td></tr>}</tbody></table></div>
    </div>
  </section>;
}

export function PayrollCenter({ rows, periods, staff, driver, management, locale, action }: { rows: Row[]; periods: Row[]; staff: Row[]; driver: boolean; management: boolean; locale: DriverLocale; action: Action }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [reopenReason, setReopenReason] = useState("");
  const c = {
    de: { title: "Meine Abrechnung", help: "Monatliche Lohnwerte, Zahlungsstatus und PDF", month: "Monat", base: "Grundgehalt", tours: "Touren", night: "Nacht", sunday: "Sonntag", holiday: "Feiertag", expenses: "Spesen", reimbursements: "Erstattungen", deductions: "Abzüge", net: "Netto", status: "Status", empty: "Noch keine Monatsabrechnung" },
    pl: { title: "Moje rozliczenie", help: "Miesięczne wynagrodzenie, status płatności i PDF", month: "Miesiąc", base: "Podstawa", tours: "Trasy", night: "Noc", sunday: "Niedziela", holiday: "Święta", expenses: "Diety", reimbursements: "Zwroty", deductions: "Potrącenia", net: "Netto", status: "Status", empty: "Brak rozliczenia" },
    uk: { title: "Мій розрахунок", help: "Місячна зарплата, статус виплати та PDF", month: "Місяць", base: "Основна зарплата", tours: "Рейси", night: "Нічні", sunday: "Неділя", holiday: "Свята", expenses: "Добові", reimbursements: "Повернення витрат", deductions: "Відрахування", net: "Нетто", status: "Статус", empty: "Розрахунку ще немає" },
    ru: { title: "Мой расчёт", help: "Месячная зарплата, статус выплаты и PDF", month: "Месяц", base: "Основная зарплата", tours: "Рейсы", night: "Ночные", sunday: "Воскресенье", holiday: "Праздники", expenses: "Суточные", reimbursements: "Возврат расходов", deductions: "Удержания", net: "Нетто", status: "Статус", empty: "Расчёта пока нет" },
  }[locale];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await action({ action: "savePayroll", id: selected?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setSelected(null); event.currentTarget.reset();
  }
  const periodRow = periods.find((row) => row.period === period);
  const isClosed = periodRow?.status === "closed";
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await action({ action: "calculatePayrollPeriod", ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
  }
  async function reopen() {
    await action({ action: "reopenPayrollPeriod", period, reason: reopenReason }); setReopenReason("");
  }
  return <div className="advanced-stack payroll-workspace">
    {!driver ? <div className="panel payroll-automation"><div className="panel-title"><div><h2>Monat automatisch abrechnen</h2><p>Abgeschlossene Touren, Spesen, Nacht-/Sonntag-/Feiertagszuschläge und freigegebene Erstattungen werden zusammengeführt.</p></div><span className={`period-state state-${String(periodRow?.status || "open")}`}>{periodRow?.status === "closed" ? "Geschlossen" : periodRow?.status === "review" ? "In Prüfung" : "Offen"}</span></div><form className="payroll-auto-form" onSubmit={calculate}>
      <label>Abrechnungsmonat<input name="period" type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label>Spesen je Tour €<input name="spesenRate" type="number" min="0" step="0.01" defaultValue="14" /></label>
      <label>Nacht je Tour €<input name="nightRate" type="number" min="0" step="0.01" defaultValue="25" /></label>
      <label>Sonntag je Tour €<input name="sundayRate" type="number" min="0" step="0.01" defaultValue="50" /></label>
      <label>Feiertag je Tour €<input name="holidayRate" type="number" min="0" step="0.01" defaultValue="100" /></label>
      <button className="primary-button" disabled={isClosed}>Automatisch berechnen</button>
    </form><div className="payroll-period-actions"><span>Die Sätze sind Firmenregeln und können vor jeder Berechnung angepasst werden.</span>{!isClosed ? <><button onClick={() => action({ action: "setPayrollPeriodStatus", period, status: "review" })}>Zur Prüfung</button><button className="close-period-button" onClick={() => action({ action: "setPayrollPeriodStatus", period, status: "closed" })}>Monat schließen</button></> : management ? <><input value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Begründung für Wiederöffnung" /><button className="reopen-period-button" disabled={reopenReason.trim().length < 5} onClick={reopen}>Mit Management-Freigabe öffnen</button></> : <strong>Nur Management kann diesen Monat wieder öffnen.</strong>}</div>{periodRow?.closed_at ? <div className="period-audit">Geschlossen am {dateText(periodRow.closed_at)} von {periodRow.closed_by_name || "Buchhaltung"}{periodRow.reopen_reason ? ` · Letzte Wiederöffnung: ${periodRow.reopen_reason}` : ""}</div> : null}</div> : null}
    {!driver ? <div className="panel"><div className="panel-title"><div><h2>Abrechnung prüfen und korrigieren</h2><p>Automatische Werte können vor dem Monatsabschluss nachvollziehbar angepasst werden.</p></div></div><form className="payroll-form" onSubmit={submit} key={String(selected?.id || "new")}>
      <select name="staffId" required defaultValue={String(selected?.staff_id || "")}><option value="">Mitarbeiter</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select>
      <label>Monat<input name="period" type="month" required defaultValue={String(selected?.period || new Date().toISOString().slice(0, 7))} /></label>
      <label>Grundgehalt<input name="baseSalary" type="number" step="0.01" min="0" defaultValue={String(selected?.base_salary || 0)} /></label>
      <label>Anzahl Touren<input name="tourCount" type="number" min="0" defaultValue={String(selected?.tour_count || 0)} /></label>
      <label>Spesen<input name="expenses" type="number" step="0.01" defaultValue={String(selected?.expenses || 0)} /></label>
      <label>Nachtzuschläge<input name="nightBonus" type="number" step="0.01" defaultValue={String(selected?.night_bonus || 0)} /></label>
      <label>Sonntagszuschläge<input name="sundayBonus" type="number" step="0.01" defaultValue={String(selected?.sunday_bonus || 0)} /></label>
      <label>Feiertagszuschläge<input name="holidayBonus" type="number" step="0.01" defaultValue={String(selected?.holiday_bonus || 0)} /></label>
      <label>Erstattungen<input name="reimbursements" type="number" step="0.01" defaultValue={String(selected?.reimbursements || 0)} /></label>
      <label>Abzüge<input name="deductions" type="number" step="0.01" defaultValue={String(selected?.deductions || 0)} /></label>
      <label>Zahlungsstatus<select name="paymentStatus" defaultValue={String(selected?.payment_status || "draft")}><option value="draft">Entwurf</option><option value="review">Prüfung</option><option value="approved">Freigegeben</option><option value="paid">Bezahlt</option></select></label>
      <button className="primary-button">Abrechnung speichern</button>{selected ? <button type="button" onClick={() => setSelected(null)}>Abbrechen</button> : null}
    </form></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>{driver ? c.title : "Lohnjournal"}</h2><p>{driver ? c.help : "Monatliche Lohnwerte, Zahlungsstatus, Berechnungsquelle und PDF"}</p></div></div><div className="table-wrap"><table className="payroll-ledger"><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>{driver ? c.month : "Monat"}</th><th>{driver ? c.base : "Grundgehalt"}</th><th>{driver ? c.tours : "Touren"}</th><th>{c.expenses}</th><th>{c.night}</th><th>{c.sunday}</th><th>{c.holiday}</th><th>{c.reimbursements}</th><th>{c.deductions}</th><th>{c.net}</th><th>{c.status}</th><th>PDF</th>{!driver ? <th /> : null}</tr></thead><tbody>{rows.length ? rows.map((row) => { const closed = periods.some((item) => item.period === row.period && item.status === "closed"); return <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td><strong>{row.period}</strong>{closed ? <small className="locked-note">🔒 geschlossen</small> : null}</td><td>{euro(row.base_salary)}</td><td>{row.tour_count}</td><td>{euro(row.expenses)}</td><td>{euro(row.night_bonus)}</td><td>{euro(row.sunday_bonus)}</td><td>{euro(row.holiday_bonus)}</td><td>{euro(row.reimbursements)}</td><td>{euro(row.deductions)}</td><td><strong>{euro(row.net_amount)}</strong></td><td><span className="status-pill">{row.payment_status}</span></td><td><a href={`/api/payroll/${row.id}/pdf`} target="_blank">PDF ↓</a></td>{!driver ? <td>{closed ? <span className="locked-note">Gesperrt</span> : <button className="edit-action" onClick={() => setSelected(row)}>Bearbeiten</button>}</td> : null}</tr>; }) : <tr><td colSpan={14}>{driver ? c.empty : "Noch keine Monatsabrechnung"}</td></tr>}</tbody></table></div></div>
  </div>;
}

export function MaintenanceCenter({ rows, vehicles, canEdit, action }: { rows: Row[]; vehicles: Row[]; canEdit: boolean; action: Action }) {
  const [editing, setEditing] = useState<Row | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await action({ action: editing ? "updateMaintenance" : "addMaintenance", id: editing?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setEditing(null); event.currentTarget.reset();
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

export function ExcelImporter({ staff, vehicles, planning, year, kw, reload }: { staff: Row[]; vehicles: Row[]; planning: Row[]; year: number; kw: number; reload: () => Promise<void> }) {
  const [type, setType] = useState("staff"); const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [fileName, setFileName] = useState(""); const [result, setResult] = useState(""); const [sheets, setSheets] = useState<{ sheet: string; data: unknown[][] }[]>([]); const [selectedSheet, setSelectedSheet] = useState("");
  function prepareMatrix(source: unknown[][]) {
    const matrix = source.filter((row) => row.some((cell) => String(cell ?? "").trim()));
    const headerIndex = matrix.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
    if (headerIndex < 0) return setResult("Keine Tabellenüberschrift erkannt");
    const headers = matrix[headerIndex].map((cell, index) => String(cell ?? "").trim() || `Spalte ${index + 1}`);
    const parsed = matrix.slice(headerIndex + 1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))).filter((row) => Object.values(row).some((item) => String(item).trim()));
    setRows(parsed.slice(0, 2000)); setResult("");
  }
  async function readFile(file: File) {
    const { default: readWorkbook } = await import("read-excel-file/browser");
    const workbook = await readWorkbook(file) as { sheet: string; data: unknown[][] }[];
    setSheets(workbook); setFileName(file.name); setSelectedSheet(workbook[0]?.sheet || "");
    if (workbook[0]) prepareMatrix(workbook[0].data);
  }
  const duplicateCount = useMemo(() => rows.filter((row) => {
    const flat = Object.values(row).map(String).map((v) => v.trim().toLowerCase());
    if (type === "staff") return staff.some((item) => flat.includes(String(item.full_name).toLowerCase()));
    if (type === "vehicles") return vehicles.some((item) => flat.includes(String(item.license_plate).toLowerCase()));
    return planning.some((item) => flat.includes(String(item.driver_name || "").toLowerCase()) && flat.includes(String(item.license_plate || "").toLowerCase()));
  }).length, [rows, type, staff, vehicles, planning]);
  async function confirmImport() {
    const response = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, rows, year, kw }) });
    const value = await response.json() as { error?: string; inserted?: number; skipped?: number; errors?: string[] };
    if (!response.ok) return setResult(value.error || "Import fehlgeschlagen");
    setResult(`${value.inserted} Datensätze importiert, ${value.skipped} Duplikate/Leerzeilen übersprungen${value.errors?.length ? `, ${value.errors.length} Fehler` : ""}.`); await reload();
  }
  const headers = Object.keys(rows[0] || {}).slice(0, 8);
  return <div className="panel"><div className="panel-title"><div><h2>Excel importieren</h2><p>Voransicht und Duplikatprüfung vor dem Speichern in die Datenbank</p></div></div><div className="import-toolbar"><select value={type} onChange={(event) => { setType(event.target.value); setRows([]); }}><option value="staff">Mitarbeiter / Fahrer im System</option><option value="vehicles">Licence Plate Table</option><option value="planning">Planning Sheet für {year} / KW {kw}</option></select><input type="file" accept=".xlsx" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />{sheets.length > 1 ? <select value={selectedSheet} onChange={(event) => { const name = event.target.value; setSelectedSheet(name); const sheet = sheets.find((item) => item.sheet === name); if (sheet) prepareMatrix(sheet.data); }}>{sheets.map((sheet) => <option key={sheet.sheet}>{sheet.sheet}</option>)}</select> : null}<button className="primary-button" disabled={!rows.length} onClick={confirmImport}>Import bestätigen</button></div>{fileName ? <div className="import-summary"><strong>{fileName}</strong><span>Blatt: {selectedSheet || "—"}</span><span>{rows.length} Zeilen erkannt</span><span className={duplicateCount ? "danger-chip" : "ok-chip"}>{duplicateCount} mögliche Duplikate</span></div> : null}{result ? <div className="inline-notice">{result}</div> : null}{rows.length ? <div className="table-wrap preview-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 25).map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{String(row[header] ?? "")}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state">Excel-Datei auswählen — die Daten werden zuerst nur als Vorschau gezeigt.</div>}</div>;
}

export function SecurityCenter({ loginAudit, resetRequests, audit, action }: { loginAudit: Row[]; resetRequests: Row[]; audit: Row[]; action: Action }) {
  function backup() { window.open("/api/admin/backup", "_blank"); }
  return <div className="advanced-stack"><div className="security-grid"><div className="security-card"><strong>2FA geschützt</strong><span>Management und Buchhaltung bestätigen den Login mit einem Einmalcode.</span></div><div className="security-card"><strong>5 Fehlversuche</strong><span>Danach wird der Zugang automatisch 15 Minuten gesperrt.</span></div><div className="security-card"><strong>DSGVO-Export</strong><span>Personalbezogene Daten sind je Mitarbeiter exportierbar.</span></div><button className="security-card security-action" onClick={backup}><strong>Backup exportieren</strong><span>Strukturierte Datenbank-Sicherung als JSON herunterladen.</span></button></div>
    {resetRequests.length ? <div className="panel"><div className="panel-title"><div><h2>Offene Passwortanfragen</h2><p>Neuen Startcode im Mitarbeiterprofil vergeben und Anfrage schließen</p></div></div><div className="table-wrap"><table><thead><tr><th>Email</th><th>Anfrage</th><th /></tr></thead><tbody>{resetRequests.map((row) => <tr key={row.id}><td>{row.email}</td><td>{dateText(row.created_at)}</td><td><button className="edit-action" onClick={() => action({ action: "resolveResetRequest", id: row.id })}>Als erledigt markieren</button></td></tr>)}</tbody></table></div></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>Login-Journal</h2><p>Erfolgreiche und fehlgeschlagene Anmeldeversuche</p></div></div><div className="table-wrap"><table><thead><tr><th>Zeit</th><th>Email</th><th>Ergebnis</th><th>IP</th></tr></thead><tbody>{loginAudit.map((row) => <tr key={row.id}><td>{String(row.created_at).slice(0, 16).replace("T", " ")}</td><td>{row.email}</td><td>{Number(row.success) ? <span className="ok-chip">Erfolgreich</span> : <span className="danger-chip">Fehlgeschlagen</span>}</td><td>{row.ip_address || "—"}</td></tr>)}</tbody></table></div></div>
    <div className="panel"><div className="panel-title"><div><h2>Änderungshistorie</h2><p>Wer, wann und welche Daten geändert hat</p></div></div><div className="table-wrap"><table><thead><tr><th>Zeit</th><th>Benutzer</th><th>Aktion</th><th>Objekt</th><th>Details</th></tr></thead><tbody>{audit.map((row) => <tr key={row.id}><td>{String(row.created_at).slice(0, 16).replace("T", " ")}</td><td>{row.user_name || row.user_id}</td><td>{row.action}</td><td>{row.entity_id || "—"}</td><td><details><summary>Anzeigen</summary><pre>{String(row.details || "{}").slice(0, 1200)}</pre></details></td></tr>)}</tbody></table></div></div></div>;
}

function trackerStatus(row: Row, clock: number) {
  if (!row.recorded_at) return { label: "Kein Signal", tone: "offline" };
  const ageMinutes = (clock - new Date(String(row.recorded_at)).getTime()) / 60_000;
  if (ageMinutes > 30) return { label: "Offline", tone: "offline" };
  if (Number(row.speed_kph || 0) > 90) return { label: "Tempoalarm", tone: "alert" };
  if (Number(row.speed_kph || 0) > 3) return { label: "In Fahrt", tone: "moving" };
  return { label: "Steht", tone: "online" };
}

export function TruckTracking({ rows, vehicles, canManage, locale, action }: { rows: Row[]; vehicles: Row[]; canManage: boolean; locale: DriverLocale; action: Action }) {
  const [selectedPlate, setSelectedPlate] = useState("");
  const [history, setHistory] = useState<Row[]>([]);
  const [clock, setClock] = useState(() => new Date().getTime());
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
    form.reset();
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
        </div>
        <div className="tracker-private-map">
          <div className="tracker-grid-lines" />
          {hasPosition ? <div className={`truck-marker tracker-${status.tone}`}><span>▰</span><strong>{selected?.license_plate}</strong></div> : <div className="empty-state">{driverView ? c.noPosition : "Noch keine GPS-Position vorhanden."}</div>}
          <div className="tracker-location-label"><strong>{selected?.address || "GPS-Position"}</strong><span>{hasPosition ? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}` : "—"}</span></div>
        </div>
        {selected ? <div className="tracking-detail-grid">
          <div><span>{driverView ? c.speed : "Geschwindigkeit"}</span><strong>{Math.round(Number(selected.speed_kph || 0))} km/h</strong></div>
          <div><span>{driverView ? c.ignition : "Zündung"}</span><strong>{Number(selected.ignition) ? (driverView ? c.on : "Ein") : (driverView ? c.off : "Aus")}</strong></div>
          <div><span>{driverView ? c.odometer : "Kilometerstand"}</span><strong>{selected.odometer_km == null ? "—" : `${Number(selected.odometer_km).toLocaleString("de-DE")} km`}</strong></div>
          <div><span>Tracker</span><strong>{selected.provider} · {selected.device_id}</strong></div>
          <div><span>{driverView ? c.coordinates : "Koordinaten"}</span><strong>{hasPosition ? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}` : "—"}</strong></div>
          <div><span>{driverView ? c.source : "Datenquelle"}</span><strong>{selected.source === "demo" ? "Demo (nicht live)" : selected.source === "manual" ? "Manuell" : "GPS-Tracker"}</strong></div>
        </div> : null}
        {selected?.source === "demo" ? <div className="tracking-demo-note">Demo-Koordinaten: Für echte Live-Daten bitte den eingebauten Tracker oder Telematik-Anbieter verbinden.</div> : null}
      </section>
    </div>

    <div className="panel">
      <div className="panel-title"><div><h2>{driverView ? c.history : "Positionsverlauf"}</h2><p>{driverView ? c.historyHelp : "Die letzten 100 Meldungen des ausgewählten Fahrzeugs"}</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Zeit</th><th>Ort</th><th>Geschwindigkeit</th><th>Zündung</th><th>Koordinaten</th><th>Quelle</th></tr></thead><tbody>{history.length ? history.map((row, index) => <tr key={`${row.recorded_at}-${index}`}><td>{String(row.recorded_at).slice(0, 16).replace("T", " ")}</td><td>{row.address || "—"}</td><td>{Math.round(Number(row.speed_kph || 0))} km/h</td><td>{Number(row.ignition) ? "Ein" : "Aus"}</td><td>{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</td><td>{row.source === "demo" ? "Demo" : row.source === "manual" ? "Manuell" : "Tracker"}</td></tr>) : <tr><td colSpan={6}>Noch keine Positionshistorie</td></tr>}</tbody></table></div>
    </div>

    {canManage ? <div className="tracking-config-grid">
      <div className="panel">
        <div className="panel-title"><div><h2>Tracker verbinden</h2><p>Geräte-ID eindeutig einem Kennzeichen zuordnen</p></div></div>
        <form className="advanced-form tracking-form" onSubmit={saveTracker}>
          <select name="licensePlate" required defaultValue=""><option value="">Kennzeichen wählen</option>{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.license_plate}</option>)}</select>
          <select name="provider" defaultValue="Webfleet"><option>Webfleet</option><option>Samsara</option><option>Geotab</option><option>Verizon Connect</option><option>Fleet Complete</option><option>Andere</option></select>
          <input name="deviceId" required placeholder="Geräte-ID / IMEI" />
          <button className="primary-button">Tracker speichern</button>
        </form>
        <div className="tracking-api-note"><strong>Geschützte Schnittstelle</strong><span>Der Anbieter sendet Daten an <code>/api/tracking/ingest</code>. Der geheime Zugriffsschlüssel wird nur auf dem Server gespeichert.</span></div>
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
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); if (data.get("newPassword") !== data.get("confirmPassword")) return setError("Пароли не совпадают"); const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }); const result = await response.json() as { error?: string }; if (!response.ok) return setError(result.error || "Ошибка"); done(); }
  return <div className={required ? "password-overlay" : "password-inline"}><form className="password-change-card" onSubmit={submit}><span className="secure-label"><i /> Sicherheit</span><h2>{required ? "Стартовый пароль нужно изменить" : "Пароль ändern"}</h2><p>Минимум 10 символов, заглавная буква и цифра.</p><label>Текущий пароль<input name="currentPassword" type="password" required /></label><label>Новый пароль<input name="newPassword" type="password" minLength={10} required /></label><label>Повторите пароль<input name="confirmPassword" type="password" minLength={10} required /></label>{error ? <div className="login-error">{error}</div> : null}<button className="primary-button">Надёжно сохранить</button></form></div>;
}
