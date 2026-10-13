export type PayrollRecord = {
  name: string;
  period: string;
  baseSalary: number;
  tourCount: number;
  expenses: number;
  nightBonus: number;
  sundayBonus: number;
  holidayBonus: number;
  reimbursements: number;
  deductions: number;
  netAmount: number;
};

const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9äöüßа-яіїєґąćęłńóśźż]/g, "");

const columns: Record<keyof Omit<PayrollRecord, "period">, string[]> = {
  name: ["name", "mitarbeiter", "fahrer", "employee", "driver", "fullname", "имя", "сотрудник", "водитель", "піб", "pracownik", "kierowca"],
  baseSalary: ["grundgehalt", "grundlohn", "basesalary", "base", "brutto", "gehalt", "lohn", "salary", "gross", "оклад", "зарплата", "ставка", "wynagrodzenie"],
  tourCount: ["touren", "anzahltouren", "tours", "trips", "tourcount", "рейсы", "рейсів", "trasy"],
  expenses: ["spesen", "verpflegung", "expenses", "diäten", "суточные", "діурні", "diety"],
  nightBonus: ["nacht", "nachtzuschlag", "nachtzuschläge", "night", "nightbonus", "ночные", "нічні"],
  sundayBonus: ["sonntag", "sonntagszuschlag", "sonntagszuschläge", "sunday", "sundaybonus", "воскресенье", "неділя"],
  holidayBonus: ["feiertag", "feiertagszuschlag", "feiertagszuschläge", "holiday", "holidaybonus", "праздники", "свята"],
  reimbursements: ["erstattung", "erstattungen", "reimbursement", "reimbursements", "auslagen", "возмещение", "компенсации"],
  deductions: ["abzüge", "abzug", "deductions", "deduction", "удержания", "вычеты", "відрахування"],
  netAmount: ["netto", "nettolohn", "auszahlung", "net", "netamount", "netpay", "к выплате", "kвыплате", "квыплате", "нетто", "довиплати"],
};

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").replace(/[^\d,.\-]/g, "");
  if (!text) return 0;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const normalized = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

const months: Record<string, string> = {
  januar: "01", jan: "01", februar: "02", feb: "02", märz: "03", maerz: "03", mär: "03", april: "04", apr: "04", mai: "05", juni: "06", jun: "06", juli: "07", jul: "07", august: "08", aug: "08", september: "09", sep: "09", oktober: "10", okt: "10", november: "11", nov: "11", dezember: "12", dez: "12",
};

export function parsePeriod(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  const text = String(value ?? "").trim().toLowerCase();
  let match = text.match(/^(20\d{2})[-/.](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}`;
  match = text.match(/(?:^|[^\d])(\d{1,2})[-/.](20\d{2})$/) || text.match(/^(?:\d{1,2}[-/.])?(\d{1,2})[-/.](20\d{2})$/);
  if (match) return `${match[2]}-${match[1].padStart(2, "0")}`;
  match = text.match(/([a-zä]+)\.?\s*(20\d{2})/);
  if (match && months[match[1]]) return `${match[2]}-${months[match[1]]}`;
  return null;
}

/** Maps a parsed spreadsheet (header-keyed rows) to payroll records. */
export function mapPayrollRows(rows: Record<string, unknown>[], fallbackPeriod: string): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  for (const row of rows) {
    const entries = Object.entries(row).map(([key, value]) => [norm(key), value] as const);
    const pick = (field: keyof typeof columns) => {
      for (const alias of columns[field]) {
        const hit = entries.find(([key]) => key === norm(alias));
        if (hit && String(hit[1] ?? "").trim() !== "") return hit[1];
      }
      return undefined;
    };
    const name = String(pick("name") ?? "").trim();
    if (!name) continue;
    const periodEntry = entries.find(([key]) => ["monat", "zeitraum", "periode", "period", "month", "месяц", "период", "місяць"].includes(key));
    const period = parsePeriod(periodEntry?.[1]) || fallbackPeriod;
    const record: PayrollRecord = {
      name, period,
      baseSalary: parseNumber(pick("baseSalary")),
      tourCount: Math.round(parseNumber(pick("tourCount"))),
      expenses: parseNumber(pick("expenses")),
      nightBonus: parseNumber(pick("nightBonus")),
      sundayBonus: parseNumber(pick("sundayBonus")),
      holidayBonus: parseNumber(pick("holidayBonus")),
      reimbursements: parseNumber(pick("reimbursements")),
      deductions: parseNumber(pick("deductions")),
      netAmount: 0,
    };
    const net = pick("netAmount");
    const extras = record.nightBonus + record.sundayBonus + record.holidayBonus + record.expenses + record.reimbursements - record.deductions;
    if (net !== undefined && !record.baseSalary) record.baseSalary = Math.max(0, Math.round((parseNumber(net) - extras) * 100) / 100);
    record.netAmount = Math.round((record.baseSalary + extras) * 100) / 100;
    records.push(record);
  }
  return records;
}

export function parseCsv(text: string): Record<string, string>[] {
  const delimiter = (text.split("\n")[0].match(/;/g)?.length || 0) >= (text.split("\n")[0].match(/,/g)?.length || 0) ? ";" : ",";
  const lines: string[][] = [];
  let cell = "", row: string[] = [], quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) { if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char; }
    else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); cell = ""; if (row.some((item) => item.trim())) lines.push(row); row = []; }
    else cell += char;
  }
  row.push(cell); if (row.some((item) => item.trim())) lines.push(row);
  const [headers = [], ...body] = lines;
  return body.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim() || `Spalte ${index + 1}`, cells[index] ?? ""])));
}
