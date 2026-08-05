import { env } from "cloudflare:workers";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

type Row = Record<string, string | number | null>;
const navy = rgb(0.035, 0.105, 0.19);
const mint = rgb(0.08, 0.63, 0.55);
const ink = rgb(0.12, 0.18, 0.23);
const muted = rgb(0.42, 0.48, 0.52);
const line = rgb(0.88, 0.91, 0.92);
const danger = rgb(0.78, 0.24, 0.18);
const pageSize: [number, number] = [841.89, 595.28];
const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function activeDays(value: unknown) {
  return String(value || "1,2,3,4,5,6,7")
    .split(",")
    .map(Number)
    .filter((day) => day >= 1 && day <= 7);
}

function warningList(planning: Row[], staff: Row[], vehicles: Row[]) {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const add = (key: string, text: string) => {
    if (!seen.has(key)) {
      seen.add(key);
      warnings.push(text);
    }
  };
  for (let day = 1; day <= 7; day++) {
    const daily = planning.filter((row) =>
      activeDays(row.work_days).includes(day),
    );
    for (const row of daily) {
      const time = String(row.start_time || "06:00");
      if (!row.license_plate)
        add(
          `plate-${row.id}`,
          `${row.driver_name || "Einsatz"}: Kennzeichen fehlt.`,
        );
      if (row.driver_name) {
        const driver = staff.find(
          (person) => person.full_name === row.driver_name,
        );
        if (!driver || driver.status !== "active")
          add(
            `inactive-${row.driver_name}`,
            `Fahrer ${row.driver_name} ist nicht aktiv.`,
          );
        if (
          daily.some(
            (other) =>
              other.id !== row.id &&
              other.driver_name === row.driver_name &&
              String(other.start_time || "06:00") === time,
          )
        )
          add(
            `driver-${day}-${row.driver_name}-${time}`,
            `${days[day - 1]} ${time}: ${row.driver_name} ist doppelt eingeplant.`,
          );
      }
      if (row.license_plate) {
        const vehicle = vehicles.find(
          (item) => item.license_plate === row.license_plate,
        );
        if (vehicle?.status === "workshop")
          add(
            `workshop-${row.license_plate}`,
            `${row.license_plate} ist in der Werkstatt.`,
          );
        if (
          daily.some(
            (other) =>
              other.id !== row.id &&
              other.license_plate === row.license_plate &&
              String(other.start_time || "06:00") === time,
          )
        )
          add(
            `vehicle-${day}-${row.license_plate}-${time}`,
            `${days[day - 1]} ${time}: ${row.license_plate} ist mehrfach zugeordnet.`,
          );
      }
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const vehicle of vehicles) {
    if (!vehicle.inspection_due) continue;
    const due = new Date(String(vehicle.inspection_due));
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= 30)
      add(
        `inspection-${vehicle.id}`,
        daysLeft < 0
          ? `TÜV/HU/SP ${vehicle.license_plate}: ${Math.abs(daysLeft)} Tage abgelaufen.`
          : `TÜV/HU/SP ${vehicle.license_plate}: noch ${daysLeft} Tage gültig.`,
      );
  }
  return warnings;
}

export async function GET(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher"]);
  await ensureDomainDatabase();
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());
  const kw = Number(url.searchParams.get("kw") || 1);
  const [planningResult, staffResult, vehicleResult, concernResult] =
    await Promise.all([
      env.DB.prepare(
        "SELECT * FROM weekly_planning WHERE planning_year=? AND calendar_week=? ORDER BY company, start_time, driver_name",
      )
        .bind(year, kw)
        .all<Row>(),
      env.DB.prepare("SELECT * FROM staff ORDER BY full_name").all<Row>(),
      env.DB.prepare(
        "SELECT * FROM vehicles ORDER BY status, license_plate",
      ).all<Row>(),
      env.DB.prepare(
        "SELECT * FROM driver_concerns WHERE completion_status NOT IN ('Erledigt','Delivered') ORDER BY created_at DESC",
      ).all<Row>(),
    ]);
  const planning = planningResult.results;
  const staff = staffResult.results;
  const vehicles = vehicleResult.results;
  const openCases = concernResult.results;
  const warnings = warningList(planning, staff, vehicles);
  const blockRejections = planning.filter(
    (row) =>
      row.status === "attention" ||
      /block|reject|problem|offen/i.test(String(row.comments || "")),
  );

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontHeaders = request.headers.get("cookie")
    ? { cookie: request.headers.get("cookie") || "" }
    : undefined;
  const [regularResponse, boldResponse] = await Promise.all([
    fetch(new URL("/DejaVuSans.ttf", request.url), { headers: fontHeaders }),
    fetch(new URL("/DejaVuSans-Bold.ttf", request.url), {
      headers: fontHeaders,
    }),
  ]);
  if (!regularResponse.ok || !boldResponse.ok)
    return Response.json(
      { error: "PDF-Schrift konnte nicht geladen werden" },
      { status: 500 },
    );
  const regular = await pdf.embedFont(await regularResponse.arrayBuffer(), {
    subset: true,
  });
  const bold = await pdf.embedFont(await boldResponse.arrayBuffer(), {
    subset: true,
  });
  const fit = (value: unknown, width: number, size = 8) => {
    const text = String(value ?? "—").replace(/\s+/g, " ");
    if (regular.widthOfTextAtSize(text, size) <= width) return text;
    let shortened = text;
    while (
      shortened.length > 1 &&
      regular.widthOfTextAtSize(`${shortened}…`, size) > width
    )
      shortened = shortened.slice(0, -1);
    return `${shortened}…`;
  };
  const header = (title: string, subtitle: string) => {
    const page = pdf.addPage(pageSize);
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: height - 72,
      width,
      height: 72,
      color: navy,
    });
    page.drawText("LOGIPAY", {
      x: 34,
      y: height - 36,
      size: 18,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(title, {
      x: 150,
      y: height - 34,
      size: 15,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(subtitle, {
      x: 150,
      y: height - 52,
      size: 8,
      font: regular,
      color: rgb(0.68, 0.78, 0.82),
    });
    page.drawText(
      `Erstellt: ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date())}`,
      {
        x: width - 188,
        y: height - 42,
        size: 7,
        font: regular,
        color: rgb(0.72, 0.8, 0.84),
      },
    );
    return page;
  };
  const table = (
    page: ReturnType<typeof header>,
    y: number,
    headers: string[],
    widths: number[],
    rows: unknown[][],
  ) => {
    const left = 34;
    const rowHeight = 22;
    const total = widths.reduce((a, b) => a + b, 0);
    let x = left;
    page.drawRectangle({
      x: left,
      y: y - rowHeight + 5,
      width: total,
      height: rowHeight,
      color: rgb(0.94, 0.97, 0.97),
    });
    headers.forEach((label, index) => {
      page.drawText(label, {
        x: x + 6,
        y: y - 10,
        size: 7,
        font: bold,
        color: muted,
      });
      x += widths[index];
    });
    y -= rowHeight;
    for (const row of rows) {
      x = left;
      page.drawLine({
        start: { x: left, y: y + 5 },
        end: { x: left + total, y: y + 5 },
        thickness: 0.5,
        color: line,
      });
      row.forEach((value, index) => {
        page.drawText(fit(value, widths[index] - 12), {
          x: x + 6,
          y: y - 9,
          size: 8,
          font: regular,
          color: ink,
        });
        x += widths[index];
      });
      y -= rowHeight;
    }
    return y;
  };

  const assignmentPage = header(
    `Planning Report ${year} / KW ${kw}`,
    `Fahrerzuordnung · Verantwortlich: ${user.fullName}`,
  );
  const metrics = [
    ["Einsätze", planning.length, mint],
    ["Offene Fälle", openCases.length, rgb(0.91, 0.61, 0.18)],
    ["Hinweise", warnings.length, warnings.length ? danger : mint],
    [
      "Werkstatt",
      vehicles.filter((v) => v.status === "workshop").length,
      danger,
    ],
  ] as const;
  metrics.forEach(([label, value, color], index) => {
    const x = 34 + index * 194;
    assignmentPage.drawRectangle({
      x,
      y: 446,
      width: 180,
      height: 46,
      color: rgb(0.965, 0.975, 0.98),
      borderColor: line,
      borderWidth: 0.7,
    });
    assignmentPage.drawText(String(value), {
      x: x + 12,
      y: 463,
      size: 17,
      font: bold,
      color,
    });
    assignmentPage.drawText(label, {
      x: x + 45,
      y: 466,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  assignmentPage.drawText("Fahrerzuordnung", {
    x: 34,
    y: 425,
    size: 12,
    font: bold,
    color: ink,
  });
  table(
    assignmentPage,
    413,
    ["Tage", "Beginn", "Fahrer", "Kennzeichen", "Firma", "Block ID", "Status"],
    [58, 54, 170, 105, 145, 110, 90],
    planning.slice(0, 13).map((row) => [
      activeDays(row.work_days)
        .map((day) => days[day - 1])
        .join(","),
      row.start_time || "06:00",
      row.driver_name || "NO DRIVER",
      row.license_plate || "—",
      row.company,
      row.block_id || "—",
      row.status,
    ]),
  );

  const casePage = header(
    "Operative Fälle",
    `KW ${kw} · Block Rejections und offene Fahreranliegen`,
  );
  let y = 492;
  casePage.drawText("Block Rejections", {
    x: 34,
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  y = table(
    casePage,
    y - 12,
    ["Fahrer", "Kennzeichen", "Block ID", "Status", "Hinweis"],
    [175, 110, 120, 90, 278],
    (blockRejections.length
      ? blockRejections
      : [
          {
            driver_name: "Keine Block Rejections",
            license_plate: "—",
            block_id: "—",
            status: "—",
            comments: "—",
          },
        ]
    )
      .slice(0, 8)
      .map((row) => [
        row.driver_name,
        row.license_plate,
        row.block_id,
        row.status,
        row.comments,
      ]),
  );
  y -= 14;
  casePage.drawText("Open Cases / Fahreranliegen", {
    x: 34,
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  table(
    casePage,
    y - 12,
    ["Datum", "Firma", "LKW", "Anliegen", "Status"],
    [85, 135, 110, 343, 100],
    (openCases.length
      ? openCases
      : [
          {
            created_at: "—",
            company: "Keine offenen Fälle",
            truck_number: "—",
            item_name: "—",
            completion_status: "Erledigt",
          },
        ]
    )
      .slice(0, 8)
      .map((row) => [
        String(row.created_at || "").slice(0, 10),
        row.company,
        row.truck_number,
        row.item_name,
        row.completion_status,
      ]),
  );

  const statusPage = header(
    "Fahrzeugstatus & wichtige Hinweise",
    `KW ${kw} · Prüfungen und Freigabe`,
  );
  y = 492;
  statusPage.drawText("Fahrzeugstatus", {
    x: 34,
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  y = table(
    statusPage,
    y - 12,
    ["Kennzeichen", "Firma", "Standort", "Status", "TÜV/HU/SP", "Notiz"],
    [120, 145, 105, 90, 105, 208],
    vehicles
      .slice(0, 10)
      .map((row) => [
        row.license_plate,
        row.company,
        row.location,
        row.status,
        row.inspection_due || "—",
        row.notes || "—",
      ]),
  );
  y -= 14;
  statusPage.drawText("Wichtige Hinweise", {
    x: 34,
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  y -= 18;
  const notes = warnings.length
    ? warnings
    : ["Keine automatischen Konflikte oder ablaufenden Prüftermine erkannt."];
  notes.slice(0, 9).forEach((note) => {
    statusPage.drawCircle({
      x: 40,
      y: y + 2,
      size: 3,
      color: warnings.length ? danger : mint,
    });
    statusPage.drawText(fit(note, 740, 8), {
      x: 50,
      y: y - 1,
      size: 8,
      font: regular,
      color: ink,
    });
    y -= 17;
  });
  statusPage.drawLine({
    start: { x: 510, y: 65 },
    end: { x: 790, y: 65 },
    thickness: 0.8,
    color: muted,
  });
  statusPage.drawText(`Verantwortliche Disposition: ${user.fullName}`, {
    x: 510,
    y: 48,
    size: 8,
    font: regular,
    color: muted,
  });
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    page.drawText(`LOGIPAY · Planning Report ${year}/KW${kw}`, {
      x: 34,
      y: 18,
      size: 7,
      font: regular,
      color: muted,
    });
    page.drawText(`Seite ${index + 1} / ${pages.length}`, {
      x: 760,
      y: 18,
      size: 7,
      font: regular,
      color: muted,
    });
  });
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'generatePlanningReport', ?, ?, ?)",
  )
    .bind(
      user.id,
      `${year}-KW${kw}`,
      JSON.stringify({ year, kw, rows: planning.length }),
      new Date().toISOString(),
    )
    .run();
  const bytes = await pdf.save();
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Planning-Report-${year}-KW${kw}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
