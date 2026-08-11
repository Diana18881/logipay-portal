export type Row = Record<string, unknown>;

export type DepartureShiftStatus = "confirmed" | "pending" | "overdue" | "past";

export type DepartureShift = {
  key: string;
  planningId: string | number;
  shiftDate: string;
  dayNumber: number;
  driverName: string;
  company: string;
  location: string;
  licensePlate: string;
  blockId: string;
  startTime: string;
  departureAt: number;
  confirmDeadlineAt: number;
  confirmedAt?: string;
  status: DepartureShiftStatus;
};

const CONFIRM_WINDOW_HOURS = 12;

export function rowDays(row: Row) {
  const parsed = String(row.work_days || "1,2,3,4,5,6,7")
    .split(",")
    .map(Number)
    .filter((day) => day >= 1 && day <= 7);
  return new Set(parsed.length ? parsed : [1, 2, 3, 4, 5, 6, 7]);
}

export function isoWeekDateStrings(year: number, week: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(
    januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7,
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function berlinDateTimeMs(dateStr: string, timeStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = String(timeStr || "06:00").split(":").map(Number);
  const target = `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}:00`;
  for (let offsetHours = -2; offsetHours <= 2; offsetHours += 1) {
    const utcHour = hour - offsetHours;
    const probe = new Date(Date.UTC(year, month - 1, day, utcHour, minute || 0, 0));
    const berlin = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(probe);
    if (berlin.replace(" ", "T") === target) return probe.getTime();
  }
  return Date.UTC(year, month - 1, day, hour, minute || 0, 0);
}

export function buildDepartureShifts({
  planning,
  year,
  kw,
  confirmations,
  now = Date.now(),
}: {
  planning: Row[];
  year: number;
  kw: number;
  confirmations: Row[];
  now?: number;
}) {
  const weekDates = isoWeekDateStrings(year, kw);
  const confirmationMap = new Map<string, string>();
  for (const item of confirmations) {
    confirmationMap.set(`${item.planning_id}:${item.shift_date}`, String(item.confirmed_at || ""));
  }

  const shifts: DepartureShift[] = [];
  for (const row of planning) {
    if (!row.driver_name || String(row.status) === "vacation") continue;
    const days = rowDays(row);
    weekDates.forEach((shiftDate, index) => {
      const dayNumber = index + 1;
      if (!days.has(dayNumber)) return;
      const departureAt = berlinDateTimeMs(shiftDate, String(row.start_time || "06:00"));
      const confirmDeadlineAt = departureAt - CONFIRM_WINDOW_HOURS * 60 * 60 * 1000;
      const confirmedAt = confirmationMap.get(`${row.id}:${shiftDate}`) || undefined;
      let status: DepartureShiftStatus = "pending";
      if (departureAt <= now) status = confirmedAt ? "confirmed" : "past";
      else if (confirmedAt) status = "confirmed";
      else if (now >= confirmDeadlineAt) status = "overdue";
      shifts.push({
        key: `${row.id}:${shiftDate}`,
        planningId: row.id as string | number,
        shiftDate,
        dayNumber,
        driverName: String(row.driver_name),
        company: String(row.company || ""),
        location: String(row.location || ""),
        licensePlate: String(row.license_plate || ""),
        blockId: String(row.block_id || ""),
        startTime: String(row.start_time || "06:00"),
        departureAt,
        confirmDeadlineAt,
        confirmedAt,
        status,
      });
    });
  }

  return shifts.sort((left, right) => left.departureAt - right.departureAt);
}

export function departureShiftForPlanning(
  shifts: DepartureShift[],
  planningId: string | number,
  preferUpcoming = true,
) {
  const related = shifts.filter((shift) => String(shift.planningId) === String(planningId));
  if (!related.length) return undefined;
  const upcoming = related.filter((shift) => shift.departureAt >= Date.now());
  if (preferUpcoming && upcoming.length) return upcoming[0];
  return related[related.length - 1];
}
