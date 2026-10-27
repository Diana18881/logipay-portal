import { env } from "@logipay/env";
import { getSetting, setSetting } from "./integration-keys";

// Monthly payroll preparation ("Lohnvorerfassung") for professional drivers in Germany.
// LOGIPAY prepares gross components; taxes and social security are calculated by the tax office (DATEV export).
//
// Rules as commonly applied in 2026:
// - Tax-free surcharges §3b EStG as % of the hourly base: night 25 %, Sunday 50 %, public holiday 125 %.
// - Meal allowance (Verpflegungsmehraufwand) in Germany: 14 € for arrival/departure days or >8 h absence, 28 € for full 24 h days.
// - Overnight allowance for professional drivers sleeping in the cab: 9 € per night.
// - Statutory minimum wage 2026: 13.90 € per hour.

export type PayType = "monthly" | "hourly" | "daily";
export type PayBasis = "brutto" | "netto";
export type TourType = "nah" | "fern";

export type PayrollRules = {
  nightPercent: number;
  sundayPercent: number;
  holidayPercent: number;
  mealShort: number;
  mealFull: number;
  overnight: number;
  hoursPerDay: number;
  weeklyHours: number;
  absenceHours: number;
  minimumWage: number;
};

export const defaultRules: PayrollRules = {
  nightPercent: 25,
  sundayPercent: 50,
  holidayPercent: 125,
  mealShort: 14,
  mealFull: 28,
  overnight: 9,
  hoursPerDay: 8,
  weeklyHours: 40,
  absenceHours: 10,
  minimumWage: 13.9,
};

export async function loadRules(): Promise<PayrollRules> {
  const stored = JSON.parse((await getSetting("payroll_rules")) || "{}") as Partial<PayrollRules>;
  return { ...defaultRules, ...Object.fromEntries(Object.entries(stored).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)])) };
}

export async function saveRules(input: Record<string, unknown>) {
  const rules = { ...defaultRules };
  const limits: Record<keyof PayrollRules, [number, number]> = {
    nightPercent: [0, 100], sundayPercent: [0, 100], holidayPercent: [0, 200], mealShort: [0, 100], mealFull: [0, 200], overnight: [0, 50],
    hoursPerDay: [1, 24], weeklyHours: [1, 80], absenceHours: [0, 24], minimumWage: [0, 100],
  };
  for (const key of Object.keys(defaultRules) as (keyof PayrollRules)[]) {
    const value = Number(String(input[key] ?? rules[key]).replace(",", "."));
    if (!Number.isFinite(value) || value < limits[key][0] || value > limits[key][1]) throw new Error(`Ungültiger Wert: ${key}`);
    rules[key] = value;
  }
  await setSetting("payroll_rules", JSON.stringify(rules));
  return rules;
}

/** Reads amount, period and basis from the old free-text field, e.g. "2.400 € Netto" or "14,50 €/h brutto". */
export function parseCompensationText(text: string | null | undefined) {
  const value = String(text || "");
  const match = value.match(/\d[\d.,]*/);
  let amount = 0;
  if (match) {
    let number = match[0].replace(/[.,]+$/, "");
    if (/,\d{1,2}$/.test(number)) number = number.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(number)) number = number.replace(/\./g, "");
    else number = number.replace(/,/g, "");
    amount = Number(number) || 0;
  }
  const type: PayType = /\/\s*(h\b|std|stunde)|pro\s*stunde|per\s*hour/i.test(value) ? "hourly" : /\/\s*(tag|day)|pro\s*tag|per\s*day/i.test(value) ? "daily" : "monthly";
  const basis: PayBasis = /netto/i.test(value) ? "netto" : "brutto";
  return { amount, type, basis };
}

export function describePay(type: PayType, amount: number, basis: PayBasis) {
  const unit = type === "hourly" ? "Stunde" : type === "daily" ? "Tag" : "Monat";
  return `${amount.toLocaleString("de-DE", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })} € ${basis} / ${unit}`;
}

const round = (value: number) => Math.round(value * 100) / 100;
const euro = (value: number) => `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export function isGermanHoliday(key: string) {
  const year = Number(key.slice(0, 4));
  if (["01-01", "05-01", "10-03", "12-25", "12-26"].includes(key.slice(5))) return true;
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easter = Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  const day = Date.parse(`${key}T00:00:00Z`);
  return [-2, 1, 39, 50].some((offset) => day === easter + offset * 86_400_000);
}

export type PayrollLine = { key: string; label: string; formula: string; amount: number; taxFree?: boolean };

type WorkedDay = { night: boolean };

/** Meal and overnight allowances: long-distance tours count consecutive days as one trip. */
function allowances(days: string[], tourType: TourType, rules: PayrollRules) {
  if (!days.length) return { short: 0, full: 0, nights: 0 };
  if (tourType === "nah") {
    const short = rules.absenceHours > 8 ? days.length : 0;
    return { short, full: 0, nights: 0 };
  }
  const sorted = [...days].sort();
  let short = 0, full = 0, nights = 0;
  let streak = 1;
  const close = (length: number) => {
    if (length === 1) short += 1;
    else { short += 2; full += length - 2; nights += length - 1; }
  };
  for (let index = 1; index < sorted.length; index++) {
    const previous = Date.parse(`${sorted[index - 1]}T00:00:00Z`);
    const current = Date.parse(`${sorted[index]}T00:00:00Z`);
    if (current - previous === 86_400_000) streak += 1;
    else { close(streak); streak = 1; }
  }
  close(streak);
  return { short, full, nights };
}

export type StaffPay = { id: number; full_name: string; compensation: string | null; pay_type: string | null; pay_amount: number | null; pay_basis: string | null; tour_type: string | null; personnel_number: string | null };

export function payOf(person: StaffPay) {
  const parsed = parseCompensationText(person.compensation);
  return {
    type: (["monthly", "hourly", "daily"].includes(String(person.pay_type)) ? person.pay_type : parsed.type) as PayType,
    amount: Number(person.pay_amount ?? 0) > 0 ? Number(person.pay_amount) : parsed.amount,
    basis: (person.pay_basis === "netto" || person.pay_basis === "brutto" ? person.pay_basis : parsed.basis) as PayBasis,
    tourType: (person.tour_type === "nah" ? "nah" : "fern") as TourType,
  };
}

export function calculatePerson(input: {
  person: StaffPay; period: string; rules: PayrollRules; workedDays: Map<string, WorkedDay>; workedHours: number | null;
  vacationDays: number; sickDays: number; reimbursements: number; bonus: number; deduction: number; adjustmentNote: string;
}) {
  const { person, period, rules, workedDays, vacationDays, sickDays } = input;
  const pay = payOf(person);
  const worked = [...workedDays.keys()].sort();
  const hours = input.workedHours ?? worked.length * rules.hoursPerDay;
  const paidAbsence = vacationDays + sickDays;
  const monthlyHours = rules.weeklyHours * 4.33;
  const hourly = pay.type === "hourly" ? pay.amount : pay.type === "daily" ? pay.amount / rules.hoursPerDay : pay.amount / monthlyHours;
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];

  let base = 0;
  if (pay.type === "monthly") {
    base = pay.amount;
    lines.push({ key: "base", label: "Grundlohn", formula: `Monatslohn ${describePay("monthly", pay.amount, pay.basis)}`, amount: base });
  } else if (pay.type === "hourly") {
    const paidHours = hours + paidAbsence * rules.hoursPerDay;
    base = round(paidHours * pay.amount);
    lines.push({ key: "base", label: "Grundlohn", formula: `${num(hours)} Arbeitsstunden${paidAbsence ? ` + ${paidAbsence} Urlaubs-/Krankentage × ${num(rules.hoursPerDay)} h` : ""} = ${num(paidHours)} h × ${euro(pay.amount)}`, amount: base });
  } else {
    base = round((worked.length + paidAbsence) * pay.amount);
    lines.push({ key: "base", label: "Grundlohn", formula: `${worked.length} Arbeitstage${paidAbsence ? ` + ${paidAbsence} Urlaubs-/Krankentage` : ""} × ${euro(pay.amount)}`, amount: base });
  }

  const nightDays = worked.filter((day) => workedDays.get(day)?.night).length;
  const sundayDays = worked.filter((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0).length;
  const holidayDays = worked.filter((day) => isGermanHoliday(day)).length;
  const surcharge = (key: string, label: string, days: number, percent: number) => {
    const amount = round(days * rules.hoursPerDay * hourly * percent / 100);
    if (days) lines.push({ key, label, formula: `${days} ${days === 1 ? "Tag" : "Tage"} × ${num(rules.hoursPerDay)} h × ${euro(round(hourly))}/h × ${num(percent)} %`, amount, taxFree: true });
    return amount;
  };
  const night = surcharge("night", "Nachtzuschlag (steuerfrei)", nightDays, rules.nightPercent);
  const sunday = surcharge("sunday", "Sonntagszuschlag (steuerfrei)", sundayDays, rules.sundayPercent);
  const holiday = surcharge("holiday", "Feiertagszuschlag (steuerfrei)", holidayDays, rules.holidayPercent);

  const allowance = allowances(worked, pay.tourType, rules);
  const meals = round(allowance.short * rules.mealShort + allowance.full * rules.mealFull + allowance.nights * rules.overnight);
  if (meals) {
    const parts = [
      allowance.short ? `${allowance.short} × ${euro(rules.mealShort)} (${pay.tourType === "fern" ? "An-/Abreisetag" : "über 8 h unterwegs"})` : "",
      allowance.full ? `${allowance.full} × ${euro(rules.mealFull)} (voller Tag)` : "",
      allowance.nights ? `${allowance.nights} × ${euro(rules.overnight)} (Übernachtung im Lkw)` : "",
    ].filter(Boolean);
    lines.push({ key: "meals", label: "Spesen (steuerfrei)", formula: parts.join(" + "), amount: meals, taxFree: true });
  }

  if (input.reimbursements) lines.push({ key: "reimbursements", label: "Erstattung Belege", formula: "Freigegebene private Auslagen des Monats", amount: input.reimbursements, taxFree: true });
  if (input.bonus) lines.push({ key: "bonus", label: "Prämie", formula: input.adjustmentNote || "Von Hand eingetragen", amount: input.bonus });
  if (input.deduction) lines.push({ key: "deduction", label: "Abzug", formula: input.adjustmentNote || "Von Hand eingetragen (z. B. Vorschuss)", amount: -input.deduction });

  if (pay.amount <= 0) warnings.push("Kein Lohn hinterlegt – bitte beim Mitarbeiter Lohnart und Betrag eintragen.");
  if (pay.basis === "brutto" && pay.amount > 0 && round(hourly) < rules.minimumWage)
    warnings.push(`Stundenlohn ${euro(round(hourly))} liegt unter dem Mindestlohn von ${euro(rules.minimumWage)}.`);
  if (pay.basis === "netto") warnings.push("Nettolohnvereinbarung: Das Steuerbüro rechnet den Bruttolohn hoch.");
  if (!String(person.personnel_number || "").trim()) warnings.push("Personalnummer fehlt (für DATEV).");
  if (!worked.length && !paidAbsence) warnings.push("Keine Arbeitstage in diesem Monat gefunden.");

  const total = round(base + night + sunday + holiday + meals + input.reimbursements + input.bonus - input.deduction);
  return {
    pay,
    hourly: round(hourly),
    days: { worked: worked.length, vacation: vacationDays, sick: sickDays, night: nightDays, sunday: sundayDays, holiday: holidayDays },
    base, night, sunday, holiday, meals, bonuses: round(night + sunday + holiday), total,
    lines, warnings,
    period,
  };
}

/** Collects worked days, absences and receipts for one company month and stores the results. */
export async function calculateMonth(period: string, userId: number, options: { countPlanned: boolean }) {
  const rules = await loadRules();
  const people = await env.DB.prepare("SELECT id, full_name, compensation, pay_type, pay_amount, pay_basis, tour_type, personnel_number FROM staff WHERE status='active' ORDER BY full_name").all<StaffPay>();
  const year = Number(period.slice(0, 4));
  const now = new Date().toISOString();
  const eligibleStatuses = ["Gestartet", "Beladen", "Unterwegs", "Zugestellt", "Problem"];
  const monthStart = `${period}-01`;
  const monthEnd = `${period}-31`;
  let calculated = 0;
  for (const person of people.results) {
    const existing = await env.DB.prepare("SELECT calculation_details, bonuses, deductions FROM payroll_calculations WHERE staff_id=? AND period=?").bind(person.id, period).first<{ calculation_details: string | null }>();
    const previous = JSON.parse(existing?.calculation_details || "{}") as { adjustment?: { bonus?: number; deduction?: number; note?: string } };
    const adjustment = { bonus: Number(previous.adjustment?.bonus || 0), deduction: Number(previous.adjustment?.deduction || 0), note: String(previous.adjustment?.note || "") };

    const workedDays = new Map<string, WorkedDay>();
    let workedHours: number | null = null;
    const sheet = await env.DB.prepare("SELECT work_date, day_type, hours, night FROM work_days WHERE staff_id=? AND substr(work_date,1,7)=?").bind(person.id, period).all<{ work_date: string; day_type: string; hours: number; night: number }>();
    let sheetVacation = 0, sheetSick = 0;
    if (sheet.results.length) {
      workedHours = 0;
      for (const day of sheet.results) {
        if (day.day_type === "work") { workedDays.set(day.work_date, { night: Boolean(day.night) }); workedHours += Number(day.hours || 0); }
        else if (day.day_type === "vacation") sheetVacation += 1;
        else if (day.day_type === "sick") sheetSick += 1;
      }
    } else {
      const planned = await env.DB.prepare(
        `SELECT p.planning_year, p.calendar_week, p.work_days, p.start_time, o.status AS trip_status
         FROM weekly_planning p LEFT JOIN trip_operations o ON o.planning_id=p.id
         WHERE (p.staff_id=? OR p.driver_name=?) AND p.planning_year BETWEEN ? AND ?`,
      ).bind(person.id, person.full_name, year - 1, year + 1).all<{ planning_year: number; calendar_week: number; work_days: string | null; start_time: string | null; trip_status: string | null }>();
      for (const row of planned.results) {
        const counts = row.trip_status && row.trip_status !== "Geplant" ? eligibleStatuses.includes(row.trip_status) : options.countPlanned;
        if (!counts) continue;
        const monday = new Date(Date.UTC(row.planning_year, 0, 4));
        monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (Number(row.calendar_week) - 1) * 7);
        const startHour = Number(String(row.start_time || "06:00").slice(0, 2));
        const night = startHour >= 20 || startHour < 6;
        for (const dayNumber of String(row.work_days || "1,2,3,4,5").split(",").map(Number).filter((day) => day >= 1 && day <= 7)) {
          const date = new Date(monday);
          date.setUTCDate(monday.getUTCDate() + dayNumber - 1);
          const key = date.toISOString().slice(0, 10);
          if (key.slice(0, 7) === period) workedDays.set(key, { night: night || Boolean(workedDays.get(key)?.night) });
        }
      }
    }
    // Absences from the absence calendar (paid: vacation and sick leave), counted on working days Mon–Fri.
    const absences = await env.DB.prepare("SELECT start_date, end_date, absence_type FROM absences WHERE staff_id=? AND end_date>=? AND start_date<=?").bind(person.id, monthStart, monthEnd).all<{ start_date: string; end_date: string; absence_type: string }>();
    let vacation = sheetVacation, sick = sheetSick;
    for (const absence of absences.results) {
      for (let time = Date.parse(`${absence.start_date}T00:00:00Z`); time <= Date.parse(`${absence.end_date}T00:00:00Z`); time += 86_400_000) {
        const key = new Date(time).toISOString().slice(0, 10);
        const weekday = new Date(time).getUTCDay();
        if (key.slice(0, 7) !== period || weekday === 0 || weekday === 6 || workedDays.has(key)) continue;
        if (absence.absence_type === "sick") sick += 1; else vacation += 1;
      }
    }
    const reimbursement = await env.DB.prepare(
      "SELECT COALESCE(SUM(reimbursement_amount),0) AS total FROM expenses WHERE staff_id=? AND substr(expense_date,1,7)=? AND reimbursable=1 AND status IN ('Freigegeben','Zur Zahlung','Erstattet')",
    ).bind(person.id, period).first<{ total: number }>();
    const result = calculatePerson({
      person, period, rules, workedDays, workedHours, vacationDays: vacation, sickDays: sick,
      reimbursements: round(Number(reimbursement?.total || 0)), bonus: adjustment.bonus, deduction: adjustment.deduction, adjustmentNote: adjustment.note,
    });
    const details = JSON.stringify({ version: 2, lines: result.lines, warnings: result.warnings, days: result.days, hourly: result.hourly, pay: result.pay, adjustment, workedDays: [...workedDays.keys()].sort() });
    await env.DB.prepare(`INSERT INTO payroll_calculations (staff_id, period, base_salary, tour_count, bonuses, expenses, night_bonus, sunday_bonus, holiday_bonus, reimbursements, deductions, net_amount, payment_status, calculation_details, calculated_at, calculated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      ON CONFLICT(staff_id, period) DO UPDATE SET base_salary=excluded.base_salary, tour_count=excluded.tour_count, bonuses=excluded.bonuses, expenses=excluded.expenses, night_bonus=excluded.night_bonus, sunday_bonus=excluded.sunday_bonus, holiday_bonus=excluded.holiday_bonus, reimbursements=excluded.reimbursements, deductions=excluded.deductions, net_amount=excluded.net_amount, calculation_details=excluded.calculation_details, calculated_at=excluded.calculated_at, calculated_by=excluded.calculated_by, updated_at=excluded.updated_at`)
      .bind(person.id, period, result.base, result.days.worked, adjustment.bonus, result.meals, result.night, result.sunday, result.holiday, round(Number(reimbursement?.total || 0)), adjustment.deduction, result.total, details, now, userId, now, now).run();
    calculated += 1;
  }
  await env.DB.prepare("INSERT INTO payroll_periods (period, status, updated_at) VALUES (?, 'open', ?) ON CONFLICT(period) DO UPDATE SET updated_at=excluded.updated_at").bind(period, now).run();
  return { calculated, rules };
}
