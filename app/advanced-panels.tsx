"use client";

import { FormEvent, useMemo, useState } from "react";

type Row = Record<string, string | number | null>;
type Action = (payload: Record<string, string | number | null>) => Promise<void>;

const euro = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const dateText = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("de-DE") : "—";

export function EmployeeDocuments({ rows, staff, driver, reload }: { rows: Row[]; staff: Row[]; driver: boolean; reload: () => Promise<void> }) {
  const [notice, setNotice] = useState("");
  const [renderedAt] = useState(() => new Date().getTime());
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
      <div className="panel-title"><div><h2>{driver ? "Meine geschützten Dokumente" : "Digitale Personalakte"}</h2><p>Arbeitsvertrag, Führerschein, Fahrerkarte, Aufenthaltstitel und Krankmeldung</p></div></div>
      <form className="advanced-form" onSubmit={upload}>
        {!driver ? <select name="staffId" required defaultValue=""><option value="">Mitarbeiter wählen</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select> : null}
        <select name="category" required defaultValue=""><option value="">Dokumentart</option>{(driver ? ["Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung"] : ["Arbeitsvertrag", "Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung", "Lohnabrechnung", "Sonstiges"]).map((category) => <option key={category}>{category}</option>)}</select>
        <label>Ablaufdatum (optional)<input name="expiresAt" type="date" /></label>
        <input name="file" type="file" accept="application/pdf,image/*" required />
        <button className="primary-button">Sicher hochladen</button>
      </form>
      {notice ? <div className="inline-notice">{notice}</div> : null}
      <div className="table-wrap"><table><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>Dokument</th><th>Datei</th><th>Gültig bis</th><th>Status</th><th>Upload</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td><strong>{row.category}</strong></td><td><a href={`/api/employee-documents/${row.id}`} target="_blank" rel="noreferrer">{row.file_name}</a></td><td>{dateText(row.expires_at)}</td><td>{expiry(row.expires_at) ? <span className="danger-chip">{expiry(row.expires_at)}</span> : <span className="ok-chip">Gültig</span>}</td><td>{dateText(row.created_at)}</td></tr>) : <tr><td colSpan={6}>Noch keine Dokumente</td></tr>}</tbody></table></div>
    </div>
  </section>;
}

export function PayrollCenter({ rows, staff, driver, action }: { rows: Row[]; staff: Row[]; driver: boolean; action: Action }) {
  const [selected, setSelected] = useState<Row | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await action({ action: "savePayroll", id: selected?.id || null, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    setSelected(null); event.currentTarget.reset();
  }
  return <div className="advanced-stack">
    {!driver ? <div className="panel"><div className="panel-title"><div><h2>Monatsabrechnung erfassen</h2><p>Netto wird serverseitig berechnet und Freigaben werden protokolliert</p></div></div><form className="payroll-form" onSubmit={submit} key={String(selected?.id || "new")}>
      <select name="staffId" required defaultValue={String(selected?.staff_id || "")}><option value="">Mitarbeiter</option>{staff.map((person) => <option key={person.id} value={String(person.id)}>{person.full_name}</option>)}</select>
      <label>Monat<input name="period" type="month" required defaultValue={String(selected?.period || new Date().toISOString().slice(0, 7))} /></label>
      <label>Grundgehalt<input name="baseSalary" type="number" step="0.01" min="0" defaultValue={String(selected?.base_salary || 0)} /></label>
      <label>Anzahl Touren<input name="tourCount" type="number" min="0" defaultValue={String(selected?.tour_count || 0)} /></label>
      <label>Zuschläge<input name="bonuses" type="number" step="0.01" defaultValue={String(selected?.bonuses || 0)} /></label>
      <label>Spesen<input name="expenses" type="number" step="0.01" defaultValue={String(selected?.expenses || 0)} /></label>
      <label>Abzüge<input name="deductions" type="number" step="0.01" defaultValue={String(selected?.deductions || 0)} /></label>
      <label>Zahlungsstatus<select name="paymentStatus" defaultValue={String(selected?.payment_status || "draft")}><option value="draft">Entwurf</option><option value="review">Prüfung</option><option value="approved">Freigegeben</option><option value="paid">Bezahlt</option></select></label>
      <button className="primary-button">Abrechnung speichern</button>{selected ? <button type="button" onClick={() => setSelected(null)}>Abbrechen</button> : null}
    </form></div> : null}
    <div className="panel"><div className="panel-title"><div><h2>{driver ? "Meine Abrechnung" : "Lohnjournal"}</h2><p>Monatliche Lohnwerte, Zahlungsstatus und automatisch erzeugtes PDF</p></div></div><div className="table-wrap"><table><thead><tr>{!driver ? <th>Mitarbeiter</th> : null}<th>Monat</th><th>Grundgehalt</th><th>Touren</th><th>Zuschläge</th><th>Spesen</th><th>Abzüge</th><th>Netto</th><th>Status</th><th>PDF</th>{!driver ? <th /> : null}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{!driver ? <td>{row.full_name}</td> : null}<td>{row.period}</td><td>{euro(row.base_salary)}</td><td>{row.tour_count}</td><td>{euro(row.bonuses)}</td><td>{euro(row.expenses)}</td><td>{euro(row.deductions)}</td><td><strong>{euro(row.net_amount)}</strong></td><td><span className="status-pill">{row.payment_status}</span></td><td><a href={`/api/payroll/${row.id}/pdf`} target="_blank">PDF ↓</a></td>{!driver ? <td><button className="edit-action" onClick={() => setSelected(row)}>Bearbeiten</button></td> : null}</tr>) : <tr><td colSpan={11}>Noch keine Monatsabrechnung</td></tr>}</tbody></table></div></div>
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

export function PasswordChange({ required, done }: { required: boolean; done: () => void }) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); if (data.get("newPassword") !== data.get("confirmPassword")) return setError("Пароли не совпадают"); const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }); const result = await response.json() as { error?: string }; if (!response.ok) return setError(result.error || "Ошибка"); done(); }
  return <div className={required ? "password-overlay" : "password-inline"}><form className="password-change-card" onSubmit={submit}><span className="secure-label"><i /> Sicherheit</span><h2>{required ? "Стартовый пароль нужно изменить" : "Пароль ändern"}</h2><p>Минимум 10 символов, заглавная буква и цифра.</p><label>Текущий пароль<input name="currentPassword" type="password" required /></label><label>Новый пароль<input name="newPassword" type="password" minLength={10} required /></label><label>Повторите пароль<input name="confirmPassword" type="password" minLength={10} required /></label>{error ? <div className="login-error">{error}</div> : null}<button className="primary-button">Надёжно сохранить</button></form></div>;
}
