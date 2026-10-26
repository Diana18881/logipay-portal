import { env } from "@logipay/env";
import { getSetting, setSetting } from "./integration-keys";

// DATEV LODAS ASCII import ("Bewegungsdaten") for the monthly payroll values.
// Wage type numbers differ per client, so they are configured by the company together with its tax office.
// Bearbeitungsschlüssel: 2 = gross wage type with amount, 3 = net deduction/addition with amount.

export const datevFields = [
  { key: "base_salary", label: "Grundlohn", wageType: "2000", bs: 2 },
  { key: "bonuses", label: "Prämien", wageType: "2100", bs: 2 },
  { key: "night_bonus", label: "Nachtzuschlag", wageType: "2200", bs: 2 },
  { key: "sunday_bonus", label: "Sonntagszuschlag", wageType: "2210", bs: 2 },
  { key: "holiday_bonus", label: "Feiertagszuschlag", wageType: "2220", bs: 2 },
  { key: "expenses", label: "Spesen / Verpflegungsmehraufwand", wageType: "2300", bs: 2 },
  { key: "reimbursements", label: "Auslagenerstattung (netto)", wageType: "9000", bs: 3 },
  { key: "deductions", label: "Abzüge (netto)", wageType: "9100", bs: 3 },
] as const;

export type DatevField = (typeof datevFields)[number]["key"];

export type DatevSettings = {
  consultant: string;
  client: string;
  wageTypes: Record<DatevField, string>;
};

export async function loadDatevSettings(): Promise<DatevSettings> {
  const stored = JSON.parse((await getSetting("datev_wage_types")) || "{}") as Partial<Record<DatevField, string>>;
  return {
    consultant: (await getSetting("datev_consultant")) || "",
    client: (await getSetting("datev_client")) || "",
    wageTypes: Object.fromEntries(datevFields.map((field) => [field.key, stored[field.key] ?? field.wageType])) as Record<DatevField, string>,
  };
}

export async function saveDatevSettings(input: { consultant?: unknown; client?: unknown; wageTypes?: Record<string, unknown> }) {
  const consultant = String(input.consultant ?? "").replace(/\D/g, "");
  const client = String(input.client ?? "").replace(/\D/g, "");
  if (consultant && (consultant.length < 4 || consultant.length > 7)) throw new Error("Beraternummer: 4 bis 7 Ziffern");
  if (client && (client.length < 1 || client.length > 5)) throw new Error("Mandantennummer: 1 bis 5 Ziffern");
  const wageTypes: Record<string, string> = {};
  for (const field of datevFields) {
    const value = String(input.wageTypes?.[field.key] ?? field.wageType).replace(/\D/g, "");
    if (value && value.length > 4) throw new Error(`Lohnart für ${field.label}: höchstens 4 Ziffern`);
    wageTypes[field.key] = value;
  }
  await setSetting("datev_consultant", consultant);
  await setSetting("datev_client", client);
  await setSetting("datev_wage_types", JSON.stringify(wageTypes));
}

const amount = (value: number) => value.toFixed(2).replace(".", ",");

export async function buildLodasFile(period: string) {
  const settings = await loadDatevSettings();
  if (!settings.consultant || !settings.client) throw new Error("Bitte zuerst Berater- und Mandantennummer hinterlegen");
  const rows = await env.DB.prepare(
    `SELECT p.*, s.full_name, s.personnel_number FROM payroll_calculations p JOIN staff s ON s.id = p.staff_id
     WHERE p.period = ? ORDER BY s.full_name`,
  ).bind(period).all<Record<string, string | number | null>>();
  const missing = rows.results.filter((row) => !String(row.personnel_number || "").trim()).map((row) => String(row.full_name));
  if (missing.length) throw new Error(`Personalnummer fehlt bei: ${missing.join(", ")}`);
  const [year, month] = period.split("-");
  const date = `01.${month}.${year}`;
  const lines = [
    "[Allgemein]",
    "Ziel=LODAS",
    "Version_SST=1.0",
    `BeraterNr=${settings.consultant}`,
    `MandantenNr=${settings.client}`,
    "Datumsformat=TT.MM.JJJJ",
    "Feldtrennzeichen=;",
    "Zahlenkomma=,",
    "Stringbegrenzer=\"",
    "Kommentarzeichen=*",
    "",
    "[Satzbeschreibung]",
    "1;u_lod_bwd_buchung_standard;abrechnung_zeitraum#bwd;pnr#bwd;la_eigene#bwd;bs_nr#bwd;bs_wert_butab#bwd;",
    "",
    "[Bewegungsdaten]",
  ];
  let records = 0;
  for (const row of rows.results) {
    lines.push(`* ${String(row.full_name).replace(/[\r\n]/g, " ")}`);
    for (const field of datevFields) {
      const value = Math.abs(Number(row[field.key] || 0));
      const wageType = settings.wageTypes[field.key];
      if (!value || !wageType) continue;
      lines.push(`1;"${date}";${String(row.personnel_number).trim()};${wageType};${field.bs};${amount(value)};`);
      records += 1;
    }
  }
  return { content: lines.join("\r\n") + "\r\n", employees: rows.results.length, records };
}
