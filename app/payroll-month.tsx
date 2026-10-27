"use client";

import { FormEvent, useEffect, useState } from "react";

type Row = Record<string, string | number | null>;
type Action = (payload: Record<string, string | number | null>) => Promise<void>;
type Line = { key: string; label: string; formula: string; amount: number; taxFree?: boolean };
type Details = { version?: number; lines?: Line[]; warnings?: string[]; days?: { worked: number; vacation: number; sick: number }; hourly?: number; pay?: { type: string; amount: number; basis: string; tourType: string }; adjustment?: { bonus: number; deduction: number; note: string } };
type Rules = Record<string, number>;

const euro = (value: unknown) => Number(value || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const parse = (row: Row): Details => { try { return JSON.parse(String(row.calculation_details || "{}")); } catch { return {}; } };

const ruleFields: { key: string; label: string; unit: string; hint: string }[] = [
  { key: "nightPercent", label: "Nachtzuschlag", unit: "%", hint: "steuerfrei bis 25 % (20–6 Uhr), §3b EStG" },
  { key: "sundayPercent", label: "Sonntagszuschlag", unit: "%", hint: "steuerfrei bis 50 %" },
  { key: "holidayPercent", label: "Feiertagszuschlag", unit: "%", hint: "steuerfrei bis 125 %" },
  { key: "mealShort", label: "Spesen An-/Abreisetag", unit: "€", hint: "Inland: 14 € (auch bei über 8 h unterwegs)" },
  { key: "mealFull", label: "Spesen voller Tag", unit: "€", hint: "Inland: 28 € bei 24 h unterwegs" },
  { key: "overnight", label: "Übernachtung im Lkw", unit: "€", hint: "Pauschale für Berufskraftfahrer: 9 € je Nacht" },
  { key: "hoursPerDay", label: "Stunden je Arbeitstag", unit: "h", hint: "für Zuschläge und Stundenlohn" },
  { key: "weeklyHours", label: "Wochenstunden", unit: "h", hint: "Monatslohn ÷ (Wochenstunden × 4,33) = Stundenbasis" },
  { key: "absenceHours", label: "Abwesenheit Nahverkehr", unit: "h", hint: "über 8 h → 14 € Spesen je Tag" },
  { key: "minimumWage", label: "Mindestlohn", unit: "€/h", hint: "2026: 13,90 €" },
];

export function PayrollMonth({ rows, periods, management, action, reload }: { rows: Row[]; periods: Row[]; management: boolean; action: Action; reload: () => Promise<void> }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/payroll/rules", { cache: "no-store" }).then((r) => r.json()).then((result: { rules?: Rules }) => setRules(result.rules || null)).catch(() => undefined); }, []);

  const monthRows = rows.filter((row) => row.period === period).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  const state = periods.find((row) => row.period === period);
  const closed = state?.status === "closed";
  const sum = (key: string) => monthRows.reduce((total, row) => total + Number(row[key] || 0), 0);
  const surcharges = sum("night_bonus") + sum("sunday_bonus") + sum("holiday_bonus");
  const warnings = monthRows.flatMap((row) => (parse(row).warnings || []).map((warning) => `${row.full_name}: ${warning}`));
  const step = !monthRows.length ? 1 : closed ? 3 : 2;

  async function run(payload: Record<string, string | number | null>, done?: string) {
    setBusy(true); setMessage("");
    await action(payload);
    setBusy(false);
    if (done) setMessage(done);
  }
  async function saveRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]));
    await run({ action: "savePayrollRules", ...values }, "Lohnregeln gespeichert – jetzt neu berechnen.");
    const fresh = await fetch("/api/payroll/rules", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (fresh.rules) setRules(fresh.rules);
    setShowRules(false);
  }
  async function datev() {
    const response = await fetch(`/api/payroll/datev?period=${period}`, { cache: "no-store" });
    if (!response.ok) { const result = await response.json().catch(() => ({})); return setMessage(result.error || "DATEV-Export fehlgeschlagen"); }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `LODAS-Bewegungsdaten-${period}.txt`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="month-close">
      <section className="panel month-head">
        <div className="month-head-row">
          <label className="month-picker">Monat<input type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setOpen(null); setMessage(""); }} /></label>
          <span className={`month-state ${closed ? "is-closed" : monthRows.length ? "is-open" : ""}`}>{closed ? "Abgeschlossen" : monthRows.length ? "In Bearbeitung" : "Noch nicht berechnet"}</span>
          <div className="month-actions">
            {!closed ? <button type="button" className="primary-button" disabled={busy} onClick={() => void run({ action: "calculatePayrollPeriod", period }, `Lohnwerte für ${period} berechnet.`).then(reload)}>{busy ? "Wird berechnet …" : monthRows.length ? "Neu berechnen" : "Monat berechnen"}</button> : null}
            {!closed && monthRows.length ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void run({ action: "setPayrollPeriodStatus", period, status: "closed" })}>Monat abschließen</button> : null}
            {monthRows.length ? <button type="button" className="secondary-button" onClick={() => void datev()}>An Steuerbüro (DATEV)</button> : null}
          </div>
        </div>
        <ol className="month-steps">
          <li className={step >= 1 ? "done" : ""}><b>1</b><span>Arbeitstage kommen automatisch aus Planung, Touren und Abwesenheiten</span></li>
          <li className={step >= 2 ? "done" : ""}><b>2</b><span>Berechnen und je Fahrer prüfen – jede Zahl ist erklärt</span></li>
          <li className={step >= 3 ? "done" : ""}><b>3</b><span>Abschließen: Fahrer werden benachrichtigt, Datei geht an das Steuerbüro</span></li>
        </ol>
        {message ? <div className="inline-notice">{message}</div> : null}
        {closed && management ? <div className="month-reopen"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Grund für Wiedereröffnung" /><button type="button" disabled={reason.trim().length < 5} onClick={() => void run({ action: "reopenPayrollPeriod", period, reason }).then(() => setReason(""))}>Monat wieder öffnen</button></div> : null}
      </section>

      {monthRows.length ? <div className="month-kpis">
        <div><small>Mitarbeiter</small><b>{monthRows.length}</b></div>
        <div><small>Grundlöhne</small><b>{euro(sum("base_salary"))}</b></div>
        <div><small>Zuschläge (steuerfrei)</small><b>{euro(surcharges)}</b></div>
        <div><small>Spesen (steuerfrei)</small><b>{euro(sum("expenses"))}</b></div>
        <div><small>Erstattungen</small><b>{euro(sum("reimbursements"))}</b></div>
        <div className="month-total"><small>Gesamt vor Steuern</small><b>{euro(sum("net_amount"))}</b></div>
      </div> : null}

      {warnings.length ? <section className="panel month-warnings"><h3>Bitte prüfen ({warnings.length})</h3><ul>{warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}</ul>{warnings.length > 8 ? <small>… und {warnings.length - 8} weitere</small> : null}</section> : null}

      {monthRows.length ? <section className="month-people">
        {monthRows.map((row) => {
          const details = parse(row);
          const id = String(row.id);
          const days = details.days;
          return (
            <article key={id} className={`month-person ${open === id ? "is-open" : ""}`}>
              <header>
                <div><b>{row.full_name}</b><small>{details.pay ? `${Number(details.pay.amount).toLocaleString("de-DE")} € ${details.pay.basis} / ${details.pay.type === "hourly" ? "Stunde" : details.pay.type === "daily" ? "Tag" : "Monat"} · ${details.pay.tourType === "nah" ? "Nahverkehr" : "Fernverkehr"}` : "Alte Berechnung – bitte neu berechnen"}</small></div>
                <div className="month-days">{days ? <><span>{days.worked} Arbeit</span>{days.vacation ? <span>{days.vacation} Urlaub</span> : null}{days.sick ? <span>{days.sick} Krank</span> : null}</> : null}</div>
                <strong>{euro(row.net_amount)}</strong>
              </header>
              <div className="month-figures">
                <span><small>Grundlohn</small>{euro(row.base_salary)}</span>
                <span><small>Zuschläge</small>{euro(Number(row.night_bonus || 0) + Number(row.sunday_bonus || 0) + Number(row.holiday_bonus || 0))}</span>
                <span><small>Spesen</small>{euro(row.expenses)}</span>
                <span><small>Erstattung</small>{euro(row.reimbursements)}</span>
                {Number(row.bonuses) ? <span><small>Prämie</small>{euro(row.bonuses)}</span> : null}
                {Number(row.deductions) ? <span><small>Abzug</small>−{euro(row.deductions)}</span> : null}
              </div>
              <div className="month-person-actions">
                <button type="button" onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Schließen" : "So wurde gerechnet"}</button>
                {!closed ? <button type="button" onClick={() => setAdjusting(adjusting === id ? null : id)}>Prämie / Abzug</button> : null}
                <a href={`/api/payroll/${id}/pdf`} target="_blank" rel="noreferrer">Lohnzettel PDF</a>
              </div>
              {open === id ? <table className="month-lines"><tbody>
                {(details.lines || []).map((line) => <tr key={line.key}><td><b>{line.label}</b><small>{line.formula}</small></td><td>{euro(line.amount)}</td></tr>)}
                <tr className="month-lines-total"><td><b>Gesamt vor Steuern</b><small>Lohnsteuer und Sozialversicherung rechnet das Steuerbüro</small></td><td>{euro(row.net_amount)}</td></tr>
              </tbody></table> : null}
              {adjusting === id ? <form className="month-adjust" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)])); void run({ action: "savePayrollAdjustment", period, staffId: row.staff_id, ...values }, "Gespeichert und neu berechnet.").then(() => setAdjusting(null)); }}>
                <label>Prämie €<input name="bonus" inputMode="decimal" defaultValue={String(details.adjustment?.bonus || "")} /></label>
                <label>Abzug € (z. B. Vorschuss)<input name="deduction" inputMode="decimal" defaultValue={String(details.adjustment?.deduction || "")} /></label>
                <label>Grund<input name="note" maxLength={160} defaultValue={details.adjustment?.note || ""} placeholder="z. B. Vorschuss 15.10." /></label>
                <button className="primary-button" disabled={busy}>Speichern</button>
              </form> : null}
            </article>
          );
        })}
      </section> : <section className="panel month-empty"><b>Noch keine Werte für {period}</b><p>„Monat berechnen“ holt Arbeitstage aus der Wochenplanung und den Touren, Urlaub und Krankheit aus dem Abwesenheitskalender und freigegebene Belege.</p></section>}

      <section className="panel month-rules">
        <button type="button" className="month-rules-toggle" onClick={() => setShowRules(!showRules)}><span><b>Lohnregeln</b><small>{rules ? `Nacht ${rules.nightPercent} % · Sonntag ${rules.sundayPercent} % · Feiertag ${rules.holidayPercent} % · Spesen ${rules.mealShort} / ${rules.mealFull} € · Übernachtung ${rules.overnight} €` : "Standard für Deutschland 2026"}</small></span><em>{showRules ? "Schließen" : "Ändern"}</em></button>
        {showRules && rules ? <form className="month-rules-form" onSubmit={saveRules}>
          {ruleFields.map((field) => <label key={field.key}><span>{field.label}</span><div><input name={field.key} inputMode="decimal" defaultValue={String(rules[field.key])} /><em>{field.unit}</em></div><small>{field.hint}</small></label>)}
          <button className="primary-button" disabled={busy}>Lohnregeln speichern</button>
        </form> : null}
      </section>
    </div>
  );
}
