import { env } from "cloudflare:workers";
import type { PortalUser } from "./auth";

export type ChatLocale = "de" | "pl" | "uk" | "ru";

type TripAccess = {
  id: number;
  planning_id: number;
  staff_id: number | null;
  driver_name: string | null;
  license_plate: string | null;
  block_id: string | null;
  staff_user_id: number | null;
};

export async function requireTripAccess(user: PortalUser, tripOperationId: number) {
  const trip = await env.DB.prepare(
    `SELECT o.id, o.planning_id, p.staff_id, p.driver_name, p.license_plate, p.block_id, s.user_id AS staff_user_id
     FROM trip_operations o
     JOIN weekly_planning p ON p.id=o.planning_id
     LEFT JOIN staff s ON s.id=p.staff_id
     WHERE o.id=?`,
  ).bind(tripOperationId).first<TripAccess>();
  if (!trip) return { error: "Tour nicht gefunden", status: 404 } as const;
  if (user.role === "accountant") return { error: "Keine Berechtigung", status: 403 } as const;
  if (user.role === "driver" && Number(trip.staff_user_id) !== user.id && trip.driver_name !== user.fullName)
    return { error: "Diese Tour ist Ihnen nicht zugeteilt", status: 403 } as const;
  return { trip } as const;
}

const phrases = [
  {
    patterns: [/verspät/i, /spóź/i, /запіз/i, /опозд/i, /опазд/i, /late/i],
    value: { de: "Ich verspäte mich.", pl: "Spóźnię się.", uk: "Я запізнююсь.", ru: "Я опаздываю." },
  },
  {
    patterns: [/stau/i, /korek/i, /затор/i, /пробк/i, /traffic/i],
    value: { de: "Ich stehe im Stau.", pl: "Stoję w korku.", uk: "Я стою в заторі.", ru: "Я стою в пробке." },
  },
  {
    patterns: [/panne/i, /awari/i, /полом/i, /несправ/i, /breakdown/i],
    value: { de: "Das Fahrzeug hat eine Panne.", pl: "Pojazd ma awarię.", uk: "Автомобіль несправний.", ru: "Машина сломалась." },
  },
  {
    patterns: [/angekomm/i, /dotar/i, /прибув/i, /прибыл/i, /arrived/i],
    value: { de: "Ich bin angekommen.", pl: "Dotarłem na miejsce.", uk: "Я прибув на місце.", ru: "Я прибыл на место." },
  },
  {
    patterns: [/belad.*fertig/i, /załad.*gotow/i, /завантаж.*заверш/i, /загруз.*заверш/i, /loading.*complete/i],
    value: { de: "Die Beladung ist abgeschlossen.", pl: "Załadunek zakończony.", uk: "Завантаження завершено.", ru: "Загрузка завершена." },
  },
  {
    patterns: [/hilfe/i, /pomoc/i, /допомог/i, /помощ/i, /help/i],
    value: { de: "Ich brauche Hilfe.", pl: "Potrzebuję pomocy.", uk: "Мені потрібна допомога.", ru: "Мне нужна помощь." },
  },
  {
    patterns: [/adresse/i, /adres/i, /адрес/i, /address/i],
    value: { de: "Bitte senden Sie mir die Adresse.", pl: "Proszę wysłać mi adres.", uk: "Будь ласка, надішліть адресу.", ru: "Пожалуйста, отправьте адрес." },
  },
  {
    patterns: [/warte/i, /czekam/i, /чекаю/i, /жду/i, /waiting/i],
    value: { de: "Ich warte vor Ort.", pl: "Czekam na miejscu.", uk: "Я чекаю на місці.", ru: "Я жду на месте." },
  },
] as const;

export function normalizeLocale(value: unknown): ChatLocale {
  return ["de", "pl", "uk", "ru"].includes(String(value)) ? String(value) as ChatLocale : "de";
}

export function detectLanguage(text: string, preferred: ChatLocale): ChatLocale {
  if (/[іїєґІЇЄҐ]/.test(text)) return "uk";
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) return "pl";
  if (/[а-яёА-ЯЁ]/.test(text)) return "ru";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  return preferred;
}

export function buildTranslations(text: string, source: ChatLocale) {
  const matches = phrases.filter((phrase) => phrase.patterns.some((pattern) => pattern.test(text)));
  if (!matches.length) return { [source]: text };
  const minutes = text.match(/\b(\d{1,3})\s*(?:min(?:uten)?|min\.?|хв(?:илин)?|мин(?:ут)?)/i)?.[1] || "";
  const minuteLabel: Record<ChatLocale, string> = { de: "Min.", pl: "min", uk: "хв", ru: "мин" };
  return Object.fromEntries((["de", "pl", "uk", "ru"] as ChatLocale[]).map((locale) => [
    locale,
    `${matches.map((match) => match.value[locale]).join(" ")}${minutes ? ` (${minutes} ${minuteLabel[locale]})` : ""}`,
  ]));
}
