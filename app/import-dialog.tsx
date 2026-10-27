"use client";

import { useState } from "react";

type Kind = "staff" | "vehicles";
type Row = Record<string, string>;

// Column names people actually use in their Excel lists, mapped to our fields.
const columns: Record<Kind, { key: string; label: string; match: RegExp; required?: boolean }[]> = {
  staff: [
    { key: "fullName", label: "Name", match: /^(name|fahrer|mitarbeiter|vor.*nach.*name|full.?name|имя|фио|imi[eę])/i, required: true },
    { key: "personnelNumber", label: "Personalnr.", match: /(personal|pers\.?.?nr|pnr|nummer)/i },
    { key: "location", label: "Standort", match: /(standort|ort|niederlassung|location|depot|base)/i },
    { key: "company", label: "Firma", match: /(firma|company|arbeitgeber|subunternehmer)/i },
    { key: "compensation", label: "Vergütung", match: /(lohn|gehalt|vergütung|salary|netto|brutto)/i },
    { key: "systemType", label: "System", match: /(system|schicht|modell)/i },
    { key: "hiredAt", label: "Eintritt", match: /(eintritt|seit|start|hired)/i },
  ],
  vehicles: [
    { key: "licensePlate", label: "Kennzeichen", match: /(kennzeichen|kfz|plate|номер)/i, required: true },
    { key: "location", label: "Standort", match: /(standort|ort|depot|location)/i },
    { key: "company", label: "Firma", match: /(firma|company|halter)/i },
    { key: "inspectionDue", label: "TÜV / HU", match: /(tüv|tuev|hu|inspektion|prüfung)/i },
  ],
};

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  const separator = (lines[0]?.match(/;/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0] || "");
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((cell, index) => [headers[index] || `Spalte ${index + 1}`, cell])));
}

function toDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (german) return `${german[3].length === 2 ? "20" + german[3] : german[3]}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

export function ImportDialog({ kind, close, done }: { kind: Kind; close: () => void; done: (message: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = columns[kind];

  async function read(file: File) {
    setError("");
    let raw: Record<string, unknown>[] = [];
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: readWorkbook } = await import("read-excel-file/browser");
        const workbook = await readWorkbook(file) as { data: unknown[][] }[];
        const matrix = (workbook[0]?.data || []).filter((row) => row.some((cell) => String(cell ?? "").trim()));
        const headers = (matrix[0] || []).map((cell, index) => String(cell ?? "").trim() || `Spalte ${index + 1}`);
        raw = matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
      } else {
        raw = parseCsv(await file.text());
      }
    } catch {
      return setError("Datei konnte nicht gelesen werden. Bitte als .xlsx oder .csv speichern.");
    }
    const headers = Object.keys(raw[0] || {});
    const mapping = Object.fromEntries(fields.map((field) => [field.key, headers.find((header) => field.match.test(header))]));
    const required = fields.find((field) => field.required)!;
    if (!mapping[required.key]) return setError(`Spalte „${required.label}“ nicht gefunden. Erste Zeile muss Überschriften enthalten.`);
    const mapped = raw.map((record) => Object.fromEntries(fields.map((field) => {
      const value = mapping[field.key] ? record[mapping[field.key]!] : "";
      return [field.key, field.key === "inspectionDue" || field.key === "hiredAt" ? toDate(value) : String(value ?? "").trim()];
    }))).filter((row) => row[required.key]);
    if (!mapped.length) return setError("Keine Einträge gefunden.");
    setRows(mapped.slice(0, 500));
  }

  async function save() {
    setBusy(true);
    const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind === "staff" ? "importStaff" : "importVehicles", rows: JSON.stringify(rows) }) });
    const result = await response.json().catch(() => ({})) as { error?: string; imported?: number; skipped?: number };
    setBusy(false);
    if (!response.ok) return setError(result.error || "Import fehlgeschlagen");
    done(`${result.imported ?? 0} importiert${result.skipped ? `, ${result.skipped} schon vorhanden` : ""}`);
  }

  const template = kind === "staff" ? "Name;Personalnummer;Standort;Firma;Vergütung;System;Eintritt\nMax Mustermann;1001;Hamburg;Muster GmbH;2400 € Netto;5/2;01.03.2024\n" : "Kennzeichen;Standort;Firma;TÜV\nHH-AB 123;Hamburg;Muster GmbH;31.12.2026\n";
  return (
    <div className="invite-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="invite-dialog import-dialog" role="dialog" aria-label="Import">
        <header><div><small>AUS EXCEL IMPORTIEREN</small><h2>{kind === "staff" ? "Fahrer & Mitarbeiter" : "Fahrzeuge"}</h2></div><button type="button" onClick={close} aria-label="Schließen">×</button></header>
        {!rows.length ? <>
          <p>Excel-Datei (.xlsx) oder CSV wählen. Die erste Zeile enthält die Überschriften, z. B. {fields.map((field) => field.label).join(", ")}.</p>
          <label className="import-drop"><input type="file" accept=".xlsx,.csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); }} /><b>Datei auswählen</b><span>.xlsx oder .csv</span></label>
          <a className="import-template" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + template)}`} download={kind === "staff" ? "vorlage-mitarbeiter.csv" : "vorlage-fahrzeuge.csv"}>Vorlage herunterladen</a>
        </> : <>
          <p>{rows.length} Einträge erkannt. Bitte kurz prüfen:</p>
          <div className="import-preview"><table><thead><tr>{fields.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={index}>{fields.map((field) => <td key={field.key}>{row[field.key] || "—"}</td>)}</tr>)}</tbody></table>{rows.length > 8 ? <small>… und {rows.length - 8} weitere</small> : null}</div>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Wird importiert …" : `${rows.length} Einträge importieren`}</button>
          <button type="button" className="import-back" onClick={() => setRows([])}>Andere Datei wählen</button>
        </>}
        {error ? <div className="login-error">{error}</div> : null}
      </div>
    </div>
  );
}
