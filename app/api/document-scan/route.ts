import { requirePortalUser } from "../../../lib/auth";

const normalizeMoney = (value: string | undefined) => {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
};

const normalizeDate = (value: string | undefined) => {
  if (!value) return null;
  const iso = value.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const german = value.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
  if (german) return `${german[3]}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}`;
  return null;
};

export async function POST(request: Request) {
  await requirePortalUser(["management", "accountant", "dispatcher", "driver"]);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Maximal 15 MB" }, { status: 400 });
  const sampleBuffer = await file.slice(0, Math.min(file.size, 3 * 1024 * 1024)).arrayBuffer();
  const decoded = new TextDecoder("latin1", { fatal: false }).decode(sampleBuffer);
  const source = `${file.name.replaceAll("_", " ")} ${decoded.replace(/[^\x20-\x7EÀ-ž€]/g, " ")}`.replace(/\s+/g, " ");

  const dateMatch = source.match(/(?:datum|date|belegdatum|rechnungsdatum)?\s*[:#-]?\s*((?:20\d{2}|\d{1,2})[-/.]\d{1,2}[-/.](?:20\d{2}|\d{1,2}))/i);
  const vatMatch = source.match(/(?:mwst\.?|ust\.?|umsatzsteuer|vat)\s*(?:19\s*%)?\s*[:€-]?\s*(\d{1,6}(?:[.,]\d{2}))/i);
  const grossMatches = [...source.matchAll(/(?:gesamt|summe|total|betrag|brutto|zu\s*zahlen)\s*[:€-]?\s*(\d{1,7}(?:[.,]\d{2}))/gi)];
  const euroMatches = [...source.matchAll(/(\d{1,7}(?:[.,]\d{2}))\s*(?:€|eur|euro)/gi)];
  const grossCandidates = [...grossMatches.map((match) => normalizeMoney(match[1])), ...euroMatches.map((match) => normalizeMoney(match[1]))].filter((value): value is number => value !== null);
  const grossAmount = grossCandidates.length ? Math.max(...grossCandidates) : null;
  const vatAmount = normalizeMoney(vatMatch?.[1]);
  const plateMatch = source.toUpperCase().match(/\b([A-ZÄÖÜ]{1,3})[-\s]([A-ZÄÖÜ]{1,2})[-\s]?(\d{1,4})\b/);
  const documentMatch = source.match(/(?:rechnungs(?:nummer|nr\.?|\s*nr\.)|beleg(?:nummer|nr\.?)|dokument(?:nummer|nr\.?)|invoice\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{3,30})/i);
  const merchantMatch = source.match(/(?:shell|aral|esso|totalenergies|avia|amazon|agip|star|jet|eni|omv|orlen|circle\s*k)/i);
  const recognizedDate = normalizeDate(dateMatch?.[1]) || new Date(file.lastModified || Date.now()).toISOString().slice(0, 10);
  const recognizedFields = [dateMatch, grossAmount !== null, vatAmount !== null, plateMatch, documentMatch].filter(Boolean).length;
  const confidence = Math.min(98, 38 + recognizedFields * 12 + (file.type === "application/pdf" ? 8 : 0));
  const plate = plateMatch ? `${plateMatch[1]}-${plateMatch[2]} ${plateMatch[3]}` : null;

  return Response.json({
    ok: true,
    result: {
      date: recognizedDate,
      grossAmount,
      vatAmount,
      licensePlate: plate,
      documentNumber: documentMatch?.[1] || null,
      merchant: merchantMatch?.[0] || null,
      confidence,
      status: recognizedFields >= 3 ? "Automatisch erkannt" : recognizedFields ? "Teilweise erkannt" : "Manuelle Prüfung",
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
