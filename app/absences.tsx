"use client";

import { FormEvent, useMemo, useState } from "react";
import { EmptyState } from "./empty-state";

type Row = Record<string, string | number | null>;

const typeLabel: Record<string, string> = { vacation: "Urlaub", sick: "Krank" };
const de = (value: unknown) => new Date(`${String(value)}T00:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" });

export function AbsenceCalendar({ staff, absences, canEdit, action }: { staff: Row[]; absences: Row[]; canEdit: boolean; action: (payload: Record<string, unknown>) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [busy, setBusy] = useState(false);
  const people = staff.filter((person) => person.status === "active");
  const [year, monthNumber] = month.split("-").map(Number);
  const days = useMemo(() => Array.from({ length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index + 1));
    return { key: date.toISOString().slice(0, 10), day: index + 1, weekend: [0, 6].includes(date.getUTCDay()) };
  }), [year, monthNumber]);
  const cell = (staffId: unknown, key: string) => absences.find((item) => String(item.staff_id) === String(staffId) && String(item.start_date) <= key && String(item.end_date) >= key);
  const involved = people.filter((person) => absences.some((item) => String(item.staff_id) === String(person.id) && String(item.end_date) >= days[0].key && String(item.start_date) <= days[days.length - 1].key));
  const upcoming = absences.filter((item) => String(item.end_date) >= today).sort((left, right) => String(left.start_date).localeCompare(String(right.start_date)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    await action({ action: "addAbsence", ...values });
    setBusy(false);
    form.reset();
  }

  return <div className="advanced-stack">
    {canEdit ? <div className="panel"><div className="panel-title"><div><h2>Abwesenheit eintragen</h2><p>Urlaub und Krankmeldungen an einem Ort. Die KW-Planung warnt automatisch, und die Lohn-Arbeitszeit übernimmt die Tage.</p></div></div>
      <form className="absence-form" onSubmit={submit}>
        <label>Mitarbeiter<select name="staffId" required defaultValue=""><option value="" disabled>Wählen …</option>{people.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select></label>
        <label>Art<select name="absenceType" defaultValue="vacation"><option value="vacation">Urlaub</option><option value="sick">Krank</option></select></label>
        <label>Von<input name="startDate" type="date" required defaultValue={today} /></label>
        <label>Bis<input name="endDate" type="date" required defaultValue={today} /></label>
        <label className="absence-note">Notiz<input name="note" placeholder="optional" maxLength={300} /></label>
        <button className="primary-button" disabled={busy}>Eintragen</button>
      </form>
    </div> : null}
    <div className="panel">
      <div className="panel-title"><div><h2>Kalender {month}</h2><p>Wer ist wann nicht verfügbar</p></div><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="month-input" /></div>
      {involved.length ? <div className="absence-grid-wrap"><table className="absence-grid"><thead><tr><th>Mitarbeiter</th>{days.map((day) => <th key={day.key} className={day.weekend ? "weekend" : ""}>{day.day}</th>)}</tr></thead><tbody>
        {involved.map((person) => <tr key={String(person.id)}><td>{String(person.full_name)}</td>{days.map((day) => { const hit = cell(person.id, day.key); return <td key={day.key} className={`${day.weekend ? "weekend " : ""}${hit ? `abs-${hit.absence_type}` : ""}`} title={hit ? `${typeLabel[String(hit.absence_type)]} ${de(hit.start_date)}–${de(hit.end_date)}` : undefined}>{hit ? (hit.absence_type === "sick" ? "K" : "U") : ""}</td>; })}</tr>)}
      </tbody></table></div> : <EmptyState icon="☂" title="In diesem Monat ist niemand abwesend" hint="Urlaub oder Krankmeldungen oben eintragen – sie erscheinen hier und in der Planung." />}
      <div className="absence-legend"><span><i className="abs-vacation" /> Urlaub (U)</span><span><i className="abs-sick" /> Krank (K)</span></div>
    </div>
    <div className="panel"><div className="panel-title"><div><h2>Aktuelle und kommende Abwesenheiten</h2><p>{upcoming.length} Einträge</p></div></div>
      {upcoming.length ? <div className="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Art</th><th>Zeitraum</th><th>Notiz</th>{canEdit ? <th /> : null}</tr></thead><tbody>
        {upcoming.map((item) => <tr key={String(item.id)}><td><strong>{String(item.full_name)}</strong></td><td><span className={`absence-pill abs-${item.absence_type}`}>{typeLabel[String(item.absence_type)]}</span></td><td>{de(item.start_date)} – {de(item.end_date)}</td><td>{item.note || "—"}</td>{canEdit ? <td><button className="delete-action" onClick={() => confirm("Abwesenheit löschen?") && void action({ action: "deleteAbsence", id: item.id })}>Löschen</button></td> : null}</tr>)}
      </tbody></table></div> : <EmptyState icon="✓" title="Keine geplanten Abwesenheiten" />}
    </div>
  </div>;
}
