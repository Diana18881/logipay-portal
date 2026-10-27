"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | null>;

const euro = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const monthLabel = (period: string) => new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(`${period}-01T12:00:00`)).replace(".", "");

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** Animated bar chart in plain SVG. */
function Bars({ values, labels, format, accent = "teal" }: { values: number[]; labels: string[]; format: (value: number) => string; accent?: "teal" | "blue" }) {
  const max = Math.max(...values, 1);
  return (
    <div className={`chart-bars chart-${accent}`}>
      {values.map((value, index) => (
        <div key={labels[index]} className="chart-bar" title={`${labels[index]}: ${format(value)}`}>
          <span className="chart-value">{value ? format(value) : ""}</span>
          <i style={{ height: `${Math.max(value ? 6 : 2, (value / max) * 100)}%`, animationDelay: `${index * 60}ms` }} />
          <small>{labels[index]}</small>
        </div>
      ))}
    </div>
  );
}

export function SetupGuide({ staff, vehicles, planning, onAddStaff, onImport, onAddVehicle, onPlan, onInvite }: {
  staff: Row[]; vehicles: Row[]; planning: Row[];
  onAddStaff: () => void; onImport: () => void; onAddVehicle: () => void; onPlan: () => void; onInvite: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem("logipay_setup_hidden") === "1"); } catch { /* optional */ } }, []);
  const steps = [
    { done: staff.length > 0, title: "Fahrer anlegen", text: "Einzeln oder alle auf einmal aus Excel.", actions: [["Fahrer anlegen", onAddStaff], ["Aus Excel importieren", onImport]] as const },
    { done: vehicles.length > 0, title: "Fahrzeuge anlegen", text: "Kennzeichen, Standort und TÜV-Termin.", actions: [["Fahrzeug anlegen", onAddVehicle]] as const },
    { done: planning.length > 0, title: "Erste Tour planen", text: "Fahrer und Fahrzeug einer Woche zuordnen.", actions: [["Tour planen", onPlan]] as const },
    { done: staff.some((person) => person.login_email), title: "Fahrer einladen", text: "Link per WhatsApp – der Fahrer installiert die App selbst.", actions: [["Fahrer einladen", onInvite]] as const },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  if (hidden || doneCount === steps.length) return null;
  const next = steps.findIndex((step) => !step.done);
  return (
    <section className="setup-guide panel">
      <header>
        <div><small>ERSTE SCHRITTE</small><h2>In 4 Schritten startklar</h2></div>
        <div className="setup-progress"><b>{doneCount}/4</b><span><i style={{ width: `${(doneCount / 4) * 100}%` }} /></span></div>
        <button type="button" className="setup-hide" onClick={() => { setHidden(true); try { localStorage.setItem("logipay_setup_hidden", "1"); } catch { /* optional */ } }}>Ausblenden</button>
      </header>
      <ol>
        {steps.map((step, index) => (
          <li key={step.title} className={`${step.done ? "setup-done" : ""} ${index === next ? "setup-current" : ""}`}>
            <span>{step.done ? "✓" : index + 1}</span>
            <div><b>{step.title}</b><small>{step.text}</small></div>
            {!step.done ? <div className="setup-actions">{step.actions.map(([label, action], actionIndex) => <button key={label} type="button" className={actionIndex === 0 && index === next ? "primary-button" : ""} onClick={action}>{label}</button>)}</div> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OfficeCharts({ staff, planning, expenses, payroll, employeeDocuments, open }: {
  staff: Row[]; planning: Row[]; expenses: Row[]; payroll: Row[]; employeeDocuments: Row[]; open: (section: string) => void;
}) {
  const months = lastMonths(6);
  const expenseByMonth = months.map((month) => expenses.filter((row) => String(row.expense_date || "").startsWith(month)).reduce((sum, row) => sum + Number(row.gross_amount || 0), 0));
  const payrollByMonth = months.map((month) => payroll.filter((row) => row.period === month).reduce((sum, row) => sum + Number(row.net_amount || 0), 0));
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const toursByDay = weekdays.map((_, index) => planning.filter((row) => String(row.work_days || "").split(",").includes(String(index + 1))).length);
  const now = Date.now();
  const expiring = employeeDocuments
    .filter((row) => row.expires_at && new Date(String(row.expires_at)).getTime() <= now + 60 * 86_400_000)
    .sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)));
  const openReceipts = expenses.filter((row) => ["Eingereicht", "Prüfen", "In Prüfung"].includes(String(row.status)));
  const kpis = [
    { label: "Aktive Fahrer", value: String(staff.filter((row) => row.status === "active").length), section: "staff" },
    { label: "Touren diese Woche", value: String(planning.length), section: "planning" },
    { label: "Belege zu prüfen", value: String(openReceipts.length), section: "expenses", alert: openReceipts.length > 0 },
    { label: "Dokumente laufen ab", value: String(expiring.length), section: "personnel", alert: expiring.length > 0 },
  ];
  return (
    <div className="office-charts">
      <div className="kpi-row">{kpis.map((kpi) => <button key={kpi.label} type="button" className={kpi.alert ? "kpi-alert" : ""} onClick={() => open(kpi.section)}><small>{kpi.label}</small><b>{kpi.value}</b></button>)}</div>
      <div className="chart-grid">
        <section className="panel chart-card"><header><h3>Ausgaben pro Monat</h3><span>{euro(expenseByMonth.reduce((a, b) => a + b, 0))} in 6 Monaten</span></header><Bars values={expenseByMonth} labels={months.map(monthLabel)} format={euro} /></section>
        <section className="panel chart-card"><header><h3>Touren diese Woche</h3><span>{planning.length} Einsätze geplant</span></header><Bars values={toursByDay} labels={weekdays} format={(value) => String(value)} accent="blue" /></section>
        <section className="panel chart-card"><header><h3>Lohnsumme</h3><span>netto pro Monat</span></header><Bars values={payrollByMonth} labels={months.map(monthLabel)} format={euro} /></section>
        <section className="panel chart-card expiring-card"><header><h3>Ablaufende Dokumente</h3><span>nächste 60 Tage</span></header>
          {expiring.length ? <ul>{expiring.slice(0, 5).map((row) => { const days = Math.ceil((new Date(String(row.expires_at)).getTime() - now) / 86_400_000); return <li key={String(row.id)}><div><b>{row.full_name}</b><small>{row.category}</small></div><em className={days <= 14 ? "urgent" : ""}>{days < 0 ? "abgelaufen" : `in ${days} Tagen`}</em></li>; })}</ul>
            : <p className="chart-empty">Alles aktuell – keine Dokumente laufen in den nächsten 60 Tagen ab.</p>}
        </section>
      </div>
    </div>
  );
}
