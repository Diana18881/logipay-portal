"use client";

import { type DragEvent, FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PortalUser } from "../lib/auth";
import { EmployeeDocuments, MaintenanceCenter, PasswordChange, PayrollCenter, SecurityCenter, TruckTracking } from "./advanced-panels";
import { AbsenceCalendar } from "./absences";
import { EmptyState } from "./empty-state";
import { AssistantWidget } from "./assistant-panel";
import { DriverAppGate } from "./driver-app-gate";
import { InviteDialog } from "./invite-dialog";
import { ImportDialog } from "./import-dialog";
import { ReadableLayout } from "./readable-layout";
import { OfficeCharts, SetupGuide } from "./office-dashboard";
import { Icon, type IconName } from "./icons";
import { isInstalledApp, isMobileDevice } from "./service-worker";
import { ChecklistCenter, ExpenseCenter, NotificationsCenter, TachographCenter, TripExecutionCenter, UserManagement } from "./operations-panels";
import { driverLanguages, driverText, type DriverLocale } from "./driver-i18n";
import { countOfflineUploads, flushOfflineUploads, loadPortalSnapshot, queueOfflineUpload, savePortalSnapshot } from "../lib/offline-client";
import { buildDepartureShifts, departureShiftForPlanning, type DepartureShift } from "../lib/departure-confirmations";

type Section =
  | "overview"
  | "tasks"
  | "driverFlow"
  | "staff"
  | "vehicles"
  | "tracking"
  | "planning"
  | "operations"
  | "messages"
  | "tachograph"
  | "expenses"
  | "checklists"
  | "notifications"
  | "users"
  | "concerns"
  | "documents"
  | "personnel"
  | "security"
  | "reports"
  | "absences";
type Row = Record<string, string | number | null>;
type SearchResult = { id: string; kind: string; title: string; meta: string; section: Section; row?: Row; plate?: string; contactKey?: string; tripId?: number };
type ThemeMode = "light" | "dark" | "system";
type DensityMode = "compact" | "comfortable" | "large";
type PortalTask = { id: string; title: string; detail: string; priority: "urgent" | "warning" | "normal"; section: Section; owner: string; due?: string };
type Data = {
  staff: Row[];
  vehicles: Row[];
  planning: Row[];
  concerns: Row[];
  voiceMessages: Row[];
  documents: Row[];
  files: Row[];
  vehicleComments: Row[];
  fuelCodes: Row[];
  fuelStops: Row[];
  driverPerformance: Row[];
  employeeDocuments: Row[];
  payroll: Row[];
  maintenance: Row[];
  tracking: Row[];
  loginAudit: Row[];
  resetRequests: Row[];
  audit: Row[];
  portalUsers: Row[];
  tachograph: Row[];
  tripOperations: Row[];
  departureConfirmations: Row[];
  tripDocuments: Row[];
  tripMessages: Row[];
  chatContacts: Row[];
  directMessages: Row[];
  expenses: Row[];
  notifications: Row[];
  checklists: Row[];
  payrollPeriods: Row[];
  workDays: Row[];
  absences: Row[];
  year: number;
  kw: number;
};

const nav: { id: Section; label: string; roles: string[] }[] = [
  { id: "overview", label: "Übersicht", roles: ["management", "accountant", "dispatcher", "driver"] },
  { id: "driverFlow", label: "Mein Arbeitstag", roles: ["driver"] },
  { id: "planning", label: "Wochenplan", roles: ["management", "dispatcher", "driver"] },
  { id: "operations", label: "Touren", roles: ["management", "dispatcher", "driver"] },
  { id: "messages", label: "Chats", roles: ["management", "dispatcher", "driver"] },
  { id: "tracking", label: "Karte", roles: ["management", "dispatcher", "driver"] },
  { id: "staff", label: "Mitarbeiter", roles: ["management", "accountant", "dispatcher"] },
  { id: "absences", label: "Urlaub & Krankheit", roles: ["management", "dispatcher"] },
  { id: "personnel", label: "Personalakte", roles: ["management", "accountant", "driver"] },
  { id: "tachograph", label: "Fahrzeiten", roles: ["management", "dispatcher", "driver"] },
  { id: "vehicles", label: "Fahrzeuge", roles: ["management", "dispatcher", "driver"] },
  { id: "checklists", label: "Fahrzeug-Check", roles: ["management", "dispatcher", "driver"] },
  { id: "expenses", label: "Belege & Auslagen", roles: ["management", "accountant", "driver"] },
  { id: "documents", label: "Lohn & Abrechnung", roles: ["management", "accountant", "driver"] },
  { id: "reports", label: "Berichte", roles: ["management", "accountant", "dispatcher"] },
  { id: "tasks", label: "Aufgaben", roles: ["management", "accountant", "dispatcher"] },
  { id: "concerns", label: "Fahreranliegen", roles: ["management", "accountant", "dispatcher", "driver"] },
  { id: "notifications", label: "Meldungen", roles: ["management", "accountant", "dispatcher", "driver"] },
  { id: "users", label: "Benutzer", roles: ["management"] },
  { id: "security", label: "Sicherheit & Audit", roles: ["management"] },
];

// A few main areas in the sidebar; everything else is a tab inside its area.
const navGroups: { id: string; title: string; icon: IconName; ids: Section[] }[] = [
  { id: "navHome", title: "Startseite", icon: "home", ids: ["driverFlow", "overview"] },
  { id: "navPlan", title: "Planung & Touren", icon: "calendar", ids: ["planning", "operations", "messages", "tracking"] },
  { id: "navPeople", title: "Fahrer & Personal", icon: "users", ids: ["staff", "absences", "personnel", "tachograph"] },
  { id: "navFleet", title: "Fuhrpark", icon: "truck", ids: ["vehicles", "checklists"] },
  { id: "navMoney", title: "Finanzen", icon: "euro", ids: ["expenses", "documents", "reports"] },
  { id: "navTasks", title: "Aufgaben & Tickets", icon: "inbox", ids: ["tasks", "concerns", "notifications"] },
  { id: "navAdmin", title: "Verwaltung", icon: "settings", ids: ["users", "security"] },
];

// Everyday words (DE/RU/UK/PL) that should find a function in the global search.
const sectionKeywords: Partial<Record<Section, string>> = {
  overview: "start startseite übersicht dashboard главная",
  driverFlow: "arbeitstag mein tag heute мой день",
  planning: "planung wochenplan kw woche dienstplan план неделя",
  operations: "touren tour zustellung lieferung cmr рейс рейсы доставка",
  messages: "chat chats nachricht nachrichten schreiben сообщения чат написать",
  tracking: "karte map gps standort fleetboard ortung карта",
  staff: "fahrer mitarbeiter personal team водители сотрудники",
  absences: "urlaub krank krankheit abwesenheit urlop отпуск больничный відпустка",
  personnel: "personalakte dokumente vertrag führerschein документы",
  tachograph: "tachograph fahrzeiten lenkzeit ruhezeit тахограф",
  vehicles: "fahrzeug fahrzeuge lkw fuhrpark tüv werkstatt reparatur unfall foto машины грузовик ремонт",
  checklists: "check fahrzeug-check kontrolle abfahrtskontrolle проверка",
  expenses: "beleg belege auslagen tanken diesel quittung erstattung чеки расходы топливо",
  documents: "lohn gehalt abrechnung lohnabrechnung datev wynagrodzenie zarplata зарплата payroll",
  reports: "berichte report auswertung pdf отчёты",
  tasks: "aufgaben todo offen задачи",
  concerns: "anliegen ticket problem bestellung обращения заявка",
  notifications: "meldungen benachrichtigungen уведомления",
  users: "benutzer login zugang passwort пользователи",
  security: "sicherheit audit protokoll безопасность",
};

// Chat housekeeping must not show the loading screen or a toast.
const quietActions = new Set(["markTripMessagesRead", "markDirectMessagesRead", "deleteTripMessage", "deleteDirectMessage"]);

const labels: Record<string, string> = {
  management: "Management",
  accountant: "Buchhaltung",
  dispatcher: "Disposition",
  driver: "Fahrer",
};

const sectionDescriptions: Partial<Record<Section, string>> = {
  overview: "Heute im Blick: Fahrer, Fahrzeuge, Touren und offene Aufgaben",
  tasks: "Alle prüfungs- und entscheidungsrelevanten Vorgänge in einer Warteschlange",
  driverFlow: "Ein klarer Ablauf von der Tour bis zum vollständigen Nachweis",
  absences: "Urlaub und Krankmeldungen – die Planung berücksichtigt sie automatisch",
  staff: "Personal, Zugänge und Beschäftigungsstatus zentral verwalten",
  vehicles: "Fahrzeugdaten, Dokumente, Prüfungen und Werkstattstatus",
  tracking: "Aktuelle Fahrzeugpositionen und operative Warnungen",
  planning: "Fahrer und Fahrzeuge konfliktfrei für die Woche einteilen",
  operations: "Tourstatus, Zustellung und Nachweise laufend aktualisieren",
  messages: "Direkte Chats mit allen Fahrern, Disposition und Management sowie Tour-Chats",
  tachograph: "Fahrzeiten, Ruhezeiten und Verstöße kontrollieren",
  expenses: "Belege prüfen, Erstattungen freigeben und Kosten auswerten",
  checklists: "Fahrzeugkontrollen vor und nach jeder Tour dokumentieren",
  concerns: "Anliegen der Fahrer annehmen, bearbeiten und abschließen",
  documents: "Monatsabrechnungen berechnen, prüfen und sicher abschließen",
  personnel: "Verträge, Führerscheine und persönliche Dokumente schützen",
  notifications: "Offene Aufgaben und alle Meldungen aus dem Betrieb an einem Ort",
  users: "Zugänge für Büro und Fahrer anlegen, Rollen vergeben, Passwörter zurücksetzen",
  security: "Anmeldungen, Änderungen und Dokumentenzugriffe nachvollziehen",
  reports: "PDF- und Excel-Berichte für Planung, Finanzamt, Auftraggeber und DATEV",
};

// Reads the old free-text pay ("2.400 € Netto") so existing staff open with sensible defaults.
function payGuess(row: Row | null) {
  const text = String(row?.compensation || "");
  const match = text.match(/\d[\d.,]*/);
  let amount = 0;
  if (match) {
    let number = match[0].replace(/[.,]+$/, "");
    if (/,\d{1,2}$/.test(number)) number = number.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(number)) number = number.replace(/\./g, "");
    else number = number.replace(/,/g, "");
    amount = Number(number) || 0;
  }
  const type = /\/\s*(h\b|std|stunde)|pro\s*stunde/i.test(text) ? "hourly" : /\/\s*(tag|day)|pro\s*tag/i.test(text) ? "daily" : "monthly";
  return { amount, type, basis: /netto/i.test(text) ? "netto" : "brutto" };
}

function isoWeekOf(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return { year: target.getUTCFullYear(), week: Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) };
}

export function Portal({ currentUser, trialDaysLeft = null, paymentProblem = false }: { currentUser: PortalUser; trialDaysLeft?: number | null; paymentProblem?: boolean }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<Data>({
    staff: [],
    vehicles: [],
    planning: [],
    concerns: [],
    voiceMessages: [],
    documents: [],
    files: [],
    vehicleComments: [],
    fuelCodes: [],
    fuelStops: [],
    driverPerformance: [],
    employeeDocuments: [],
    payroll: [],
    maintenance: [],
    tracking: [],
    loginAudit: [],
    resetRequests: [],
    audit: [],
    portalUsers: [],
    tachograph: [],
    tripOperations: [],
    departureConfirmations: [],
    tripDocuments: [],
    tripMessages: [],
    chatContacts: [],
    directMessages: [],
    expenses: [],
    notifications: [],
    checklists: [],
    payrollPeriods: [],
    workDays: [],
    absences: [],
    year: 2026,
    kw: 32,
  });
  const [year, setYear] = useState(() => isoWeekOf(new Date()).year);
  const [kw, setKw] = useState(() => isoWeekOf(new Date()).week);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    "staff" | "vehicle" | "planning" | "concern" | null
  >(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [importKind, setImportKind] = useState<"staff" | "vehicles" | null>(null);
  const [chatTripId, setChatTripId] = useState<number | null>(null);
  const [chatContactKey, setChatContactKey] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSource, setSearchSource] = useState<"top" | "hero">("top");
  const globalSearchRef = useRef<HTMLInputElement | null>(null);
  const [locale, setLocale] = useState<DriverLocale>("de");
  const [appMode, setAppMode] = useState<"checking" | "app" | "browser">("checking");
  useEffect(() => {
    // Drivers on phones and tablets work only in the installed app (offline, camera, push).
    setAppMode(isMobileDevice() && !isInstalledApp() && !currentUser.readOnly ? "browser" : "app");
  }, [currentUser.readOnly]);
  const [pushState, setPushState] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [density, setDensity] = useState<DensityMode>("large");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinnedSections, setPinnedSections] = useState<Section[]>([]);
  const [offlineUploadCount, setOfflineUploadCount] = useState(0);
  // Keep the first server and browser render identical; the real connection
  // state is applied after hydration in the effect below.
  const [online, setOnline] = useState(true);
  const [renderedAt] = useState(() => new Date().getTime());
  const isDriver = currentUser.role === "driver";
  const [lastSectionByGroup, setLastSectionByGroup] = useState<Record<string, Section>>({});
  const sectionRestored = useRef(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  // Slide the tab highlight to the active tab.
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const active = tabs?.querySelector<HTMLElement>("button.active");
    if (!tabs || !active) return;
    tabs.style.setProperty("--tab-x", `${active.offsetLeft}px`);
    tabs.style.setProperty("--tab-w", `${active.offsetWidth}px`);
    tabs.classList.add("section-tabs-ready");
  });
  useEffect(() => {
    // Only save once the remembered section was restored, so the default "overview" never overwrites it.
    if (!sectionRestored.current) return;
    try { sessionStorage.setItem("logipay_section", section); } catch { /* storage unavailable */ }
  }, [section]);
  useEffect(() => {
    const group = navGroups.find((item) => item.ids.includes(section));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (group) setLastSectionByGroup((current) => current[group.id] === section ? current : { ...current, [group.id]: section });
  }, [section]);
  const t = useCallback((key: string, fallback?: string) => driverText(locale, key, fallback), [locale]);
  const load = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const r = await fetch(`/api/portal?year=${year}&kw=${kw}`);
        if (r.status === 401) {
          location.href = "/login";
          return;
        }
        const body = await r.text();
        if (!r.ok) {
          setNotice(isDriver ? t("databaseUpdate") : "Datenbank wird aktualisiert. Bitte Seite neu laden.");
          if (!background) setLoading(false);
          return;
        }
        const parsed = JSON.parse(body) as Data;
        setData(parsed);
        void savePortalSnapshot(`portal-${currentUser.id}-${year}-${kw}`, parsed);
      } catch {
        const cached = await loadPortalSnapshot<Data>(`portal-${currentUser.id}-${year}-${kw}`);
        if (cached) { setData({ ...cached, chatContacts: cached.chatContacts || [], directMessages: cached.directMessages || [] }); setNotice(isDriver ? "Офлайн: показаны последние сохранённые данные." : "Offline: letzter gespeicherter Datenstand wird angezeigt."); }
        else setNotice(isDriver ? t("loadError") : "Daten konnten nicht geladen werden. Bitte Seite neu laden.");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [year, kw, isDriver, t, currentUser.id],
  );
  const reloadQuietly = useCallback(() => load(true), [load]);
  useEffect(() => {
    const initial = window.setTimeout(() => load(), 0);
    const refresh = window.setInterval(() => load(true), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, [load]);
  useEffect(() => {
    const savedLocale = localStorage.getItem("logipay_driver_locale") as DriverLocale | null;
    const requestedSection = new URLSearchParams(window.location.search).get("section") as Section | null;
    const supported = "serviceWorker" in navigator && "Notification" in window;
    const syncPreferences = window.setTimeout(() => {
      if (isDriver && savedLocale && driverLanguages.some((item) => item.code === savedLocale)) setLocale(savedLocale);
      let savedSection: Section | null = null;
      try { savedSection = sessionStorage.getItem("logipay_section") as Section | null; } catch { /* storage unavailable */ }
      const startSection = requestedSection || savedSection;
      if (startSection && nav.some((item) => item.id === startSection && item.roles.includes(currentUser.role))) setSection(startSection);
      sectionRestored.current = true;
      setPushState(supported ? Notification.permission : "unsupported");
    }, 0);
    if (supported) void navigator.serviceWorker.register("/sw.js");
    return () => window.clearTimeout(syncPreferences);
  }, [currentUser.role, isDriver]);
  useEffect(() => {
    const savedTheme = localStorage.getItem("logipay_theme") as ThemeMode | null;
    const savedDensity = localStorage.getItem("logipay_density") as DensityMode | null;
    const savedPinned = JSON.parse(localStorage.getItem(`logipay_pinned_${currentUser.role}`) || "[]") as Section[];
    const hydratePreferences = window.setTimeout(() => {
      if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) setTheme(savedTheme);
      if (savedDensity && ["compact", "comfortable", "large"].includes(savedDensity)) setDensity(savedDensity);
      setPinnedSections(savedPinned.filter((id) => nav.some((item) => item.id === id && item.roles.includes(currentUser.role))));
      void countOfflineUploads().then(setOfflineUploadCount);
    }, 0);
    return () => window.clearTimeout(hydratePreferences);
  }, [currentUser.role]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("logipay_theme", theme);
    localStorage.setItem("logipay_density", density);
    localStorage.setItem(`logipay_pinned_${currentUser.role}`, JSON.stringify(pinnedSections));
  }, [theme, density, pinnedSections, currentUser.role]);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchSource("top");
        globalSearchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);
  useEffect(() => {
    if (!isDriver || pushState !== "granted" || !data.notifications.length || !("serviceWorker" in navigator)) return;
    const storageKey = `logipay_last_notification_${currentUser.id}`;
    const newestId = Math.max(...data.notifications.map((item) => Number(item.id || 0)));
    const previous = Number(localStorage.getItem(storageKey) || 0);
    if (!previous) {
      localStorage.setItem(storageKey, String(newestId));
      return;
    }
    const fresh = data.notifications
      .filter((item) => !item.read_at && Number(item.id || 0) > previous)
      .sort((left, right) => Number(left.id) - Number(right.id))
      .slice(-3);
    if (!fresh.length) return;
    void navigator.serviceWorker.ready.then((registration) => {
      fresh.forEach((item) => registration.showNotification(String(item.title || "LOGIPAY"), {
        body: String(item.message || ""),
        tag: `logipay-${item.id}`,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        data: { url: "/?section=notifications" },
      }));
    });
    localStorage.setItem(storageKey, String(newestId));
  }, [currentUser.id, data.notifications, isDriver, pushState]);
  useEffect(() => {
    async function flushOfflineQueue() {
      const queue = JSON.parse(localStorage.getItem("logipay_offline_queue") || "[]") as Record<string, unknown>[];
      if (!queue.length) return;
      const remaining: Record<string, unknown>[] = [];
      for (const payload of queue) {
        try {
          const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (!response.ok && response.status >= 500) remaining.push(payload);
        } catch { remaining.push(payload); }
      }
      localStorage.setItem("logipay_offline_queue", JSON.stringify(remaining));
      const fileResult = await flushOfflineUploads();
      setOfflineUploadCount(fileResult.remaining);
      if (!remaining.length && !fileResult.remaining) { setNotice(isDriver ? t("synced") : "Offline-Eingaben und Dateien wurden synchronisiert"); await load(true); }
    }
    const handleOnline = () => { setOnline(true); void flushOfflineQueue(); };
    const handleOffline = () => setOnline(false);
    const syncConnectionState = window.setTimeout(() => setOnline(navigator.onLine), 0);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    if (navigator.onLine) void flushOfflineQueue();
    return () => { window.clearTimeout(syncConnectionState); window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [isDriver, load, t]);
  function changeLocale(nextLocale: DriverLocale) {
    setLocale(nextLocale);
    localStorage.setItem("logipay_driver_locale", nextLocale);
    document.documentElement.setAttribute("lang", nextLocale === "uk" ? "uk" : nextLocale);
  }
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") void enablePush(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function enablePush(silent = false) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushState(permission);
      if (permission === "granted") {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        try {
          const { publicKey } = await (await fetch("/api/push")).json() as { publicKey?: string };
          if (publicKey && "PushManager" in window) {
            const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
            const raw = atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
            const key = Uint8Array.from(raw, (char) => char.charCodeAt(0));
            const subscription = (await registration.pushManager.getSubscription()) || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
          }
        } catch { /* fallback: local notifications while the portal is open */ }
        if (!silent) setNotice(isDriver ? t("pushReady") : "Push-Benachrichtigungen aktiviert");
      }
    } catch {
      setNotice(t("pushPermissionError"));
    }
  }
  async function action(payload: Record<string, unknown>) {
    let r: Response;
    try {
      r = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch {
      const offlineSafe = new Set(["saveTripOperation", "saveChecklist", "driverConcern", "confirmDeparture"]);
      if (!offlineSafe.has(String(payload.action || ""))) { setNotice(isDriver ? t("offlineBlocked") : "Keine Verbindung. Diese sensible Aktion wird nicht offline gespeichert."); return; }
      const queue = JSON.parse(localStorage.getItem("logipay_offline_queue") || "[]") as Record<string, unknown>[];
      queue.push(payload); localStorage.setItem("logipay_offline_queue", JSON.stringify(queue.slice(-50)));
      setNotice(isDriver ? t("offlineSaved") : "Offline gespeichert — wird bei Verbindung automatisch gesendet"); return;
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({ error: "Aktion nicht erlaubt" }));
      setNotice(e.error || "Aktion nicht erlaubt");
      return;
    }
    const result = await r.json().catch(() => ({ ok: true })) as { message?: string };
    if (quietActions.has(String(payload.action || ""))) {
      await load(true);
      return;
    }
    setModal(null);
    setEditing(null);
    setNotice(result.message || (isDriver ? t("saved") : "Änderung gespeichert"));
    // Refresh in the background so open forms, the chosen month and the selected person stay as they are.
    await load(true);
  }
  function openModal(
    kind: "staff" | "vehicle" | "planning" | "concern",
    row?: Row,
  ) {
    setEditing(row || null);
    setModal(kind);
  }
  function openVehicleProfile(licensePlate: unknown) {
    const plate = String(licensePlate || "").trim();
    if (!plate) return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", "vehicles");
    url.searchParams.set("vehicle", plate);
    url.searchParams.set("vehicleTab", "overview");
    window.history.pushState({}, "", url);
    setSection("vehicles");
  }
  function downloadPlanningReport() {
    window.location.href = `/api/reports/planning?year=${year}&kw=${kw}`;
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  const active = data.staff.filter((x) => x.status === "active");
  const workshop = data.vehicles.filter((x) => x.status === "workshop");
  const expiringDocuments = data.employeeDocuments.filter((item) => item.expires_at && new Date(String(item.expires_at)).getTime() <= renderedAt + 60 * 86400000);
  const expiringDocuments30 = data.employeeDocuments.filter((item) => item.expires_at && new Date(String(item.expires_at)).getTime() <= renderedAt + 30 * 86400000);
  const expiringTuv30 = data.vehicles.filter((vehicle) => {
    if (!vehicle.inspection_due) return false;
    const due = new Date(String(vehicle.inspection_due));
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((due.getTime() - renderedAt) / 86400000);
    return daysLeft <= 30;
  });
  const tachographViolations = data.tachograph.filter((row) => row.infringement || Number(row.remaining_minutes) <= 90);
  const driverRatingMap = useMemo(
    () => buildDriverRatingByName(data.staff, data.driverPerformance),
    [data.staff, data.driverPerformance],
  );
  const departureShifts = useMemo(
    () => buildDepartureShifts({
      planning: data.planning,
      year,
      kw,
      confirmations: data.departureConfirmations,
      now: renderedAt,
    }),
    [data.planning, data.departureConfirmations, year, kw, renderedAt],
  );
  const overdueDepartures = departureShifts.filter((shift) => shift.status === "overdue");
  const pendingDepartures = departureShifts.filter((shift) => shift.status === "pending");
  const openConcernCount = data.concerns.filter(
    (item) =>
      !["Erledigt", "Delivered"].includes(String(item.completion_status)),
  ).length + data.voiceMessages.filter((item) => String(item.status) === "Neu").length;
  const trackingAlertCount = data.tracking.filter((item) => {
    if (!item.recorded_at) return true;
    const age = renderedAt - new Date(String(item.recorded_at)).getTime();
    return age > 30 * 60_000 || Number(item.speed_kph || 0) > 90;
  }).length;
  const todayNumber = new Date().getDay() || 7;
  const todayPlanning = data.planning.filter((item) => rowDays(item).has(todayNumber));
  const delayedTrips = data.tripOperations.filter((item) => item.status === "Problem" || Boolean(item.delay_reason) || (item.eta && new Date(String(item.eta)).getTime() < renderedAt && item.status !== "Zugestellt"));
  const pendingExpenses = data.expenses.filter((item) => ["Eingereicht", "In Prüfung"].includes(String(item.status)));
  const unreadNotificationCount = data.notifications.filter((item) => !item.read_at).length;
  const unreadChatCount = [...data.tripMessages, ...data.directMessages].filter((item) => !Number(item.read_by_me) && Number(item.sender_user_id) !== currentUser.id).length;
  const assistantContext = useMemo(() => {
    const pick = (rows: Row[], keys: string[], limit = 60) => rows.slice(0, limit).map((row) => Object.fromEntries(keys.map((key) => [key, row[key]])));
    return {
      today: new Date().toISOString().slice(0, 10), year: data.year, kw: data.kw,
      staff: pick(data.staff, ["full_name", "system_type", "location", "company", "status"]),
      vehicles: pick(data.vehicles, ["license_plate", "status", "inspection_due", "location", "company"]),
      planning: pick(data.planning, ["driver_name", "license_plate", "block_id", "work_days", "start_time", "status", "comments"]),
      trips: pick(data.tripOperations, ["driver_name", "license_plate", "status", "eta", "delay_reason", "pickup_address", "delivery_address"]),
      concerns: pick(data.concerns, ["item_name", "completion_status", "period", "notes"]),
      expenses: pick(data.expenses, ["full_name", "category", "merchant", "gross_amount", "status", "expense_date"]),
      payroll: pick(data.payroll, ["full_name", "period", "base_salary", "tour_count", "net_amount", "payment_status"]),
      tachographViolations: pick(data.tachograph, ["driver_name", "license_plate", "violation", "status"], 30),
    };
  }, [data]);
  const unifiedTasks: PortalTask[] = [
    ...(["management", "dispatcher"].includes(currentUser.role) && delayedTrips.length ? [{ id: "delays", title: `${delayedTrips.length} verspätete oder problematische Touren`, detail: "ETA prüfen, Fahrer kontaktieren oder Ersatzfahrzeug einplanen", priority: "urgent" as const, section: "operations" as const, owner: "Disposition" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && unreadChatCount ? [{ id: "messages", title: `${unreadChatCount} Nachrichten beantworten`, detail: "Ungelesene Tour-Chats von Fahrern", priority: "urgent" as const, section: "messages" as const, owner: "Disposition" }] : []),
    ...(["management", "accountant"].includes(currentUser.role) && pendingExpenses.length ? [{ id: "expenses", title: `${pendingExpenses.length} Belege prüfen`, detail: `${pendingExpenses.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} warten auf Freigabe`, priority: "warning" as const, section: "expenses" as const, owner: "Buchhaltung" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && workshop.length ? [{ id: "workshop", title: `${workshop.length} Fahrzeuge in Werkstatt`, detail: "Verfügbarkeit prüfen und Touren gegebenenfalls neu zuordnen", priority: "warning" as const, section: "vehicles" as const, owner: "Fuhrpark" }] : []),
    ...(["management", "accountant"].includes(currentUser.role) && expiringDocuments.length ? [{ id: "documents", title: `${expiringDocuments.length} Dokumente verlängern`, detail: "Ablauf innerhalb der nächsten 60 Tage", priority: "warning" as const, section: "personnel" as const, owner: "Personal" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && expiringDocuments30.length ? [{ id: "documents-30", title: `${expiringDocuments30.length} Dokumente laufen bald ab`, detail: "Führerschein, Fahrerkarte oder Aufenthaltstitel innerhalb 30 Tagen", priority: "urgent" as const, section: "personnel" as const, owner: "Personal" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && expiringTuv30.length ? [{ id: "tuv-30", title: `${expiringTuv30.length} TÜV/HU/SP-Termine in 30 Tagen`, detail: "Prüftermine prüfen und Werkstatt einplanen", priority: "urgent" as const, section: "vehicles" as const, owner: "Fuhrpark" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && tachographViolations.length ? [{ id: "tachograph", title: `${tachographViolations.length} Tachograph-Warnungen`, detail: "Verstöße oder kritische Restlenkzeit", priority: "urgent" as const, section: "tachograph" as const, owner: "Disposition" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && overdueDepartures.length ? [{ id: "departure-overdue", title: `${overdueDepartures.length} Abfahrten ohne Bestätigung`, detail: "Ersatzfahrer suchen — Frist 12 Stunden vor Abfahrt überschritten", priority: "urgent" as const, section: "planning" as const, owner: "Disposition" }] : []),
    ...(["management", "dispatcher"].includes(currentUser.role) && pendingDepartures.length ? [{ id: "departure-pending", title: `${pendingDepartures.length} Abfahrten warten auf Bestätigung`, detail: "Fahrer muss Abfahrt bis 12 Stunden vor Start bestätigen", priority: "warning" as const, section: "planning" as const, owner: "Disposition" }] : []),
    ...(["management", "accountant"].includes(currentUser.role) && !data.payrollPeriods.some((row) => row.period === new Date().toISOString().slice(0, 7) && row.status === "closed") ? [{ id: "payroll", title: "Lohnmonat noch offen", detail: "Berechnung prüfen und Monat nach Freigabe schließen", priority: "normal" as const, section: "documents" as const, owner: "Buchhaltung" }] : []),
    ...(openConcernCount && currentUser.role !== "accountant" ? [{ id: "concerns", title: `${openConcernCount} Fahreranliegen bearbeiten`, detail: "Neue Anliegen, Bestellungen und Rückfragen", priority: "normal" as const, section: "concerns" as const, owner: "Disposition" }] : []),
  ];
  const globalResults = useMemo<SearchResult[]>(() => {
    const normalize = (value: unknown) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, " ");
    const words = normalize(globalSearch).trim().split(" ").filter(Boolean);
    if (!words.length || words.join("").length < 2) return [];
    const compact = (value: string) => value.replace(/ /g, "");
    // Every typed word must appear somewhere; plates match with or without spaces/dashes.
    const matches = (...values: unknown[]) => {
      const haystack = normalize(values.filter((value) => value !== null && value !== undefined).join(" "));
      return words.every((word) => haystack.includes(word) || compact(haystack).includes(word));
    };
    const results: SearchResult[] = [];
    nav.filter((item) => item.roles.includes(currentUser.role)).forEach((item) => {
      const group = navGroups.find((entry) => entry.ids.includes(item.id));
      const label = isDriver ? driverText(locale, item.id, item.label) : item.label;
      if (matches(label, item.label, group?.title, sectionKeywords[item.id], sectionDescriptions[item.id]))
        results.push({ id: `section-${item.id}`, kind: "Funktion", title: label, meta: group ? `${group.title} → ${label}` : label, section: item.id });
    });
    data.staff.filter((row) => matches(row.full_name, row.company, row.location, row.login_email)).forEach((row) => results.push({ id: `staff-${row.id}`, kind: "Fahrer", title: String(row.full_name), meta: `${row.company || "Ohne Firma"} · ${row.location || "Kein Standort"}`, section: "staff", row }));
    data.chatContacts.filter((row) => matches(row.full_name, row.license_plate, labels[String(row.role)], "chat nachricht schreiben")).forEach((row) => results.push({ id: `contact-${row.user_id || `s${row.staff_id}`}`, kind: "Chat", title: `Chat mit ${row.full_name}`, meta: row.role === "driver" ? `🚚 ${row.license_plate || "Ohne Kennzeichen"}` : labels[String(row.role)] || "", section: "messages", contactKey: row.user_id ? `user-${row.user_id}` : `staff-${row.staff_id}` }));
    data.vehicles.filter((row) => matches(row.license_plate, row.company, row.location, row.status, row.notes)).forEach((row) => results.push({ id: `vehicle-${row.id}`, kind: "Fahrzeug", title: String(row.license_plate), meta: `${row.company || "Ohne Firma"} · ${row.status || "—"}`, section: "vehicles", row, plate: String(row.license_plate) }));
    data.planning.filter((row) => matches(row.driver_name, row.license_plate, row.block_id, row.company, row.location, row.comments)).forEach((row) => results.push({ id: `planning-${row.id}`, kind: "Planung", title: `${row.driver_name || "Ohne Fahrer"} · ${row.license_plate || "Ohne Fahrzeug"}`, meta: `${row.company || "—"} · Block ${row.block_id || "—"}`, section: "planning", row }));
    data.tripOperations.filter((row) => matches(row.driver_name, row.license_plate, row.block_id, row.pickup_address, row.delivery_address, row.delay_reason)).forEach((row) => results.push({ id: `trip-${row.id}`, kind: "Tour", title: `${row.license_plate || "Tour"} · ${row.driver_name || "Ohne Fahrer"}`, meta: `${row.status || "—"} · ${row.block_id || "Kein Block"}`, section: "operations", row }));
    data.concerns.filter((row) => matches(row.item_name, row.truck_number, row.company, row.base, row.notes, row.completion_status)).forEach((row) => results.push({ id: `concern-${row.id}`, kind: "Anliegen", title: String(row.item_name || "Anliegen"), meta: `${row.truck_number || "—"} · ${row.completion_status || "Neu"}`, section: "concerns", row }));
    data.employeeDocuments.filter((row) => matches(row.full_name, row.category, row.file_name, row.document_number)).forEach((row) => results.push({ id: `employee-document-${row.id}`, kind: "Dokument", title: String(row.category || row.file_name || "Dokument"), meta: `${row.full_name || "Mitarbeiter"} · ${row.expires_at || "unbefristet"}`, section: "personnel", row }));
    data.files.filter((row) => matches(row.driver_name, row.license_plate, row.category, row.file_name, row.notes)).forEach((row) => results.push({ id: `vehicle-file-${row.id}`, kind: "Foto / Datei", title: String(row.file_name || row.category || "Fahrzeugdatei"), meta: `${row.driver_name || "Fahrer"} · ${row.license_plate || "—"}`, section: "vehicles", row, plate: row.license_plate ? String(row.license_plate) : undefined }));
    data.directMessages.filter((row) => matches(row.sender_name, row.body, row.file_name)).forEach((row) => results.push({ id: `direct-${row.id}`, kind: "Nachricht", title: String(row.sender_name || "Chat"), meta: String(row.body || row.file_name || "Anhang").slice(0, 90), section: "messages", contactKey: row.partner_user_id ? `user-${row.partner_user_id}` : `staff-${row.recipient_staff_id}` }));
    data.tripMessages.filter((row) => matches(row.sender_name, row.body, row.file_name, row.license_plate, row.block_id)).forEach((row) => results.push({ id: `message-${row.id}`, kind: "Nachricht", title: String(row.sender_name || "Tour-Chat"), meta: String(row.body || row.file_name || "Anhang").slice(0, 90), section: "messages", row, tripId: Number(row.trip_operation_id) }));
    data.expenses.filter((row) => matches(row.full_name, row.license_plate, row.block_id, row.merchant, row.receipt_number, row.cost_center, row.category)).forEach((row) => results.push({ id: `expense-${row.id}`, kind: "Ausgabe", title: `${row.merchant || row.category || "Ausgabe"} · ${Number(row.gross_amount || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`, meta: `${row.full_name || "Mitarbeiter"} · ${row.status || "—"}`, section: "expenses", row }));
    data.notifications.filter((row) => matches(row.title, row.message)).slice(0, 5).forEach((row) => results.push({ id: `notification-${row.id}`, kind: "Meldung", title: String(row.title || "Meldung"), meta: String(row.message || "").slice(0, 90), section: "notifications", row }));
    return results.slice(0, 30);
  }, [data, globalSearch, currentUser.role, isDriver, locale]);
  function openGlobalResult(result: SearchResult) {
    if (result.kind === "Fahrer" && result.row) setSelectedStaff(result.row);
    else if (result.plate) openVehicleProfile(result.plate);
    else if (result.contactKey || result.tripId) {
      setChatTripId(result.tripId ?? null);
      setChatContactKey(result.contactKey ?? null);
      setSection("messages");
    }
    else setSection(result.section);
    setSearchOpen(false);
    setGlobalSearch("");
  }
  const renderSearchResults = () => (<div className="global-search-results" onMouseDown={(event) => event.preventDefault()}>
              <header><span>Globale Suche</span><button type="button" onClick={() => setSearchOpen(false)}>Schließen</button></header>
              {globalSearch.trim().length < 2 ? <div className="global-search-hint"><b>Alles an einem Ort finden</b><span>Name, Kennzeichen, Tour, Nachricht oder eine Funktion wie „Lohn“, „Urlaub“, „Chat“ eingeben.</span></div> : globalResults.length ? globalResults.map((result) => <button type="button" key={result.id} onClick={() => openGlobalResult(result)}><span>{result.kind.slice(0, 1)}</span><div><b>{result.title}</b><small>{result.meta}</small></div><em>{result.kind}</em></button>) : <div className="global-search-hint"><b>Keine Ergebnisse</b><span>Prüfen Sie die Schreibweise oder verwenden Sie einen kürzeren Suchbegriff.</span></div>}
            </div>);
  const title = isDriver ? t(section, nav.find((n) => n.id === section)?.label) : nav.find((n) => n.id === section)?.label;
  const sectionLabel = (item: (typeof nav)[number]) => isDriver ? t(item.id, item.label) : item.label;
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.ids
      .map((id) => nav.find((item) => item.id === id))
      .filter((item): item is (typeof nav)[number] => Boolean(item && item.roles.includes(currentUser.role))),
  })).filter((group) => group.items.length);
  const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.id === section));
  const groupTitle = (group: (typeof navGroups)[number]) => isDriver ? t(group.id, group.title) : group.title;
  const openGroup = (group: (typeof visibleGroups)[number]) => {
    const remembered = lastSectionByGroup[group.id];
    setSection(remembered && group.items.some((item) => item.id === remembered) ? remembered : group.items[0].id);
  };
  const sectionCounter = (id: Section) => {
    if (id === "messages") return unreadChatCount;
    if (id === "notifications") return unreadNotificationCount;
    if (id === "tracking") return trackingAlertCount;
    if (id === "concerns" && ["management", "dispatcher"].includes(currentUser.role)) return openConcernCount;
    return 0;
  };
  if (isDriver && appMode === "browser") return <DriverAppGate locale={locale} setLocale={changeLocale} logout={logout} />;
  return (
    <main className={`app-shell section-${section} role-${currentUser.role} theme-${theme} density-${density} ${isDriver ? "driver-mobile-shell" : ""}`}>
      {mobileMenu ? <button className="backdrop" aria-label={isDriver ? t("menuClose") : "Menü schließen"} onClick={() => setMobileMenu(false)} /> : null}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>LOGIPAY</strong>
            <small title={currentUser.companyName}>{currentUser.companyName}</small>
          </div>
        </div>
        <div className="access-card">
          <span className="access-dot" />
          <div>
            <small>{isDriver ? t("signedInAs") : "ANGEMELDET ALS"}</small>
            <strong>{isDriver ? t("driver") : labels[currentUser.role]}</strong>
          </div>
        </div>
        <nav>
          {visibleGroups.map((group) => {
            const counter = group.items.reduce((sum, item) => sum + sectionCounter(item.id), 0);
            return <button
              key={group.id}
              className={activeGroup?.id === group.id ? "nav-active" : ""}
              onClick={() => { openGroup(group); setMobileMenu(false); }}
            >
              <span className="nav-icon"><Icon name={group.icon} size={20} /></span>
              {groupTitle(group)}
              {counter ? <span className={`nav-counter${group.id === "navPlan" && unreadChatCount ? " nav-counter-chat" : ""}`}>{Math.min(99, counter)}</span> : null}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              {currentUser.fullName
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <strong>{currentUser.fullName}</strong>
              <small>{isDriver ? t("driver") : labels[currentUser.role]}</small>
            </div>
          </div>
          <a className="sidebar-link" href="/app" target="_blank" rel="noreferrer"><Icon name="phone" size={18} />{isDriver ? t("installApp", "App installieren") : "Fahrer-App installieren"}</a>
          {currentUser.role === "management" ? <a className="sidebar-link" href="/abo"><Icon name="card" size={18} />Abonnement & Daten</a> : null}
          <button className="logout-button" onClick={logout}>
            ↪ {isDriver ? t("logout") : "Abmelden"}
          </button>
        </div>
      </aside>
      <section className="workspace">
        {currentUser.readOnly ? <div className="demo-banner"><span><b>Demo</b> · nur Ansicht – Änderungen werden nicht gespeichert.</span><a href={isDriver ? "/api/auth/demo" : "/api/auth/demo?as=fahrer"}>{isDriver ? "Büro-Ansicht" : "Fahrer-Ansicht"}</a><a className="demo-banner-cta" href="/registrieren">Kostenlos testen →</a></div> : null}
        {currentUser.role === "management" && !currentUser.readOnly && (paymentProblem || trialDaysLeft !== null) ? <a className={`billing-banner ${paymentProblem ? "billing-banner-alert" : ""}`} href="/abo">{paymentProblem ? "Zahlung fehlgeschlagen – bitte Zahlungsmethode im Abonnement prüfen." : `Testphase: noch ${trialDaysLeft} ${trialDaysLeft === 1 ? "Tag" : "Tage"}. Jetzt Abonnement abschließen →`}</a> : null}
        <header className="topbar">
          <button className="menu-toggle" aria-label={isDriver ? t("menuOpen") : "Menü öffnen"} onClick={() => setMobileMenu(true)}>☰</button>
          <div className="topbar-brand"><span className="brand-mark"><span /><span /><span /></span><div><b>{isDriver ? `${t("hello", "Hallo")}, ${currentUser.fullName.split(" ")[0]}` : currentUser.companyName}</b><small>{isDriver ? currentUser.companyName : labels[currentUser.role]}</small></div></div>
          <div className="period-control" role="group" aria-label={isDriver ? t("planningPeriod") : "Planungszeitraum"}>
            <button type="button" className="week-step" aria-label="Vorige Woche" title="Vorige Woche" onClick={() => { if (kw > 1) setKw(kw - 1); else { setKw(53); setYear(year - 1); } }}>‹</button>
            <select value={kw} onChange={(e) => setKw(+e.target.value)} aria-label="Kalenderwoche">
              {Array.from({ length: 53 }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>
                  KW {k}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(+e.target.value)} aria-label="Jahr">
              {Array.from(
                { length: 5 },
                (_, i) => new Date().getFullYear() - 1 + i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <button type="button" className="week-step next-week" aria-label={isDriver ? t("nextWeek") : "Nächste Woche"} title={isDriver ? t("nextWeek") : "Nächste Woche"} onClick={() => { if (kw < 53) setKw(kw + 1); else { setKw(1); setYear(year + 1); } }}>›</button>
          </div>
          <button className="mobile-global-search" type="button" aria-label="Globale Suche öffnen" onClick={() => { setSearchSource("top"); setSearchOpen(true); window.setTimeout(() => globalSearchRef.current?.focus(), 20); }}>⌕</button>
          <div className={`global-search ${searchOpen ? "global-search-open" : ""}`}>
            <label>
              <span>⌕</span>
              <input ref={globalSearchRef} value={globalSearch} onChange={(event) => { setGlobalSearch(event.target.value); setSearchSource("top"); setSearchOpen(true); }} onFocus={() => { setSearchSource("top"); setSearchOpen(true); }} onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)} placeholder="Suchen: Fahrer, LKW, Funktion …" aria-label="Portal durchsuchen" />
              <kbd>⌘ K</kbd>
            </label>
            {searchOpen && searchSource === "top" ? renderSearchResults() : null}
          </div>
          {isDriver ? <div className="driver-language-switch" role="group" aria-label={t("language")}>
            {driverLanguages.map((item) => <button key={item.code} type="button" className={locale === item.code ? "language-active" : ""} title={item.label} aria-label={item.label} onClick={() => changeLocale(item.code)}>{item.short}</button>)}
          </div> : null}
          {isDriver ? <select className="driver-language-select" value={locale} onChange={(event) => changeLocale(event.target.value as DriverLocale)} aria-label={t("language")}>
            {driverLanguages.map((item) => <option key={item.code} value={item.code}>{item.short}</option>)}
          </select> : null}
          <div className="top-actions">
            <span className={`status-dot ${online ? "" : "status-dot-offline"}`} title={online ? (isDriver ? t("connected") : "Datenbank verbunden") : (isDriver ? t("offline") : "Offline-Modus")} aria-label={online ? (isDriver ? t("connected") : "Datenbank verbunden") : (isDriver ? t("offline") : "Offline-Modus")}>
              <i />{offlineUploadCount ? <b>{offlineUploadCount}</b> : null}
            </span>
            {pushState !== "granted" && pushState !== "unsupported" ? (
              <button className="tb-icon" type="button" onClick={() => void enablePush()} title={pushState === "denied" ? t("notificationsDenied") : t("notificationsEnable")} aria-label={t("notificationsEnable")}><Icon name="bell" size={20} /></button>
            ) : null}
            {["management", "dispatcher"].includes(currentUser.role) ? (
              <button className="tb-icon tb-pdf" type="button" onClick={downloadPlanningReport} title="Planning Report als PDF herunterladen" aria-label="Planning Report PDF">PDF</button>
            ) : null}
            {["management", "dispatcher", "driver"].includes(currentUser.role) ? (
              <button className="tb-icon tb-chat" type="button" onClick={() => setSection("messages")} title={isDriver ? t("messages") : "Nachrichten"} aria-label={isDriver ? t("messages") : "Nachrichten"}>
                ✉{unreadChatCount ? <i>{Math.min(99, unreadChatCount)}</i> : null}
              </button>
            ) : null}
            <button className="tb-icon" type="button" onClick={() => setSettingsOpen(true)} title="Oberfläche anpassen" aria-label="Oberfläche anpassen">⚙</button>
          </div>
        </header>
        <div className="content">
          {activeGroup && activeGroup.items.length > 1 ? (
            <div className="section-tabs" role="tablist" aria-label={groupTitle(activeGroup)} ref={tabsRef}>
              <span className="section-tabs-indicator" aria-hidden="true" />
              {activeGroup.items.map((item) => {
                const counter = sectionCounter(item.id);
                return <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
                  {sectionLabel(item)}{counter ? <i>{Math.min(99, counter)}</i> : null}
                </button>;
              })}
            </div>
          ) : null}
          <div className="section-view" key={section}>
          <div className="page-heading">
            <div>
              <p>{activeGroup ? groupTitle(activeGroup) : isDriver ? t("logistics") : "LOGISTIKVERWALTUNG"}</p>
              <h1>{title}</h1>
              <span>{isDriver ? t("centralData") : sectionDescriptions[section] || "Zentrale Daten statt einzelner Excel-Tabellen"}</span>
            </div>
            {section === "staff" && currentUser.role === "management" ? (
              <div className="heading-actions">
                <button type="button" className="secondary-button" onClick={() => setImportKind("staff")}>Aus Excel importieren</button>
                <button className="primary-button" onClick={() => openModal("staff")}>＋ Mitarbeiter einstellen</button>
              </div>
            ) : section === "vehicles" &&
              ["management", "dispatcher"].includes(currentUser.role) ? (
              <div className="heading-actions">
                {currentUser.role === "management" ? <button type="button" className="secondary-button" onClick={() => setImportKind("vehicles")}>Aus Excel importieren</button> : null}
                <button className="primary-button" onClick={() => openModal("vehicle")}>＋ Fahrzeug anlegen</button>
              </div>
            ) : section === "planning" && currentUser.role !== "driver" ? (
              <button
                className="primary-button"
                onClick={() => openModal("planning")}
              >
                ＋ Planung für {year} / KW {kw}
              </button>
            ) : section === "concerns" && currentUser.role !== "accountant" ? (
              <button
                className="primary-button"
                onClick={() => openModal("concern")}
              >
                ＋ {isDriver ? t("newConcern") : "Anliegen erfassen"}
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="skeleton-stack" role="status" aria-label={isDriver ? t("loading") : "Daten werden geladen…"}>
              <div className="skeleton skeleton-hero" />
              <div className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
              <div className="skeleton skeleton-panel" />
            </div>
          ) : (
            <>
              {section === "overview" &&
                (currentUser.role === "driver" ? (
                  <DriverHome
                    person={data.staff[0]}
                    planning={data.planning}
                    documents={data.documents}
                    year={year}
                    kw={kw}
                    locale={locale}
                    pushState={pushState}
                    enablePush={() => enablePush()}
                    unreadCount={unreadNotificationCount}
                    openSection={setSection}
                  />
                ) : (
                  <>
                    <div className="overview-command-card overview-simple">
                      <div>
                        <small>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()} · KW {kw}</small>
                        <h2>Guten Tag, {currentUser.fullName.split(" ")[0]}</h2>
                      </div>
                      <div className="overview-search-box">
                        <label className="overview-search"><span>⌕</span><input value={globalSearch} onChange={(event) => { setGlobalSearch(event.target.value); setSearchSource("hero"); setSearchOpen(true); }} onFocus={() => { setSearchSource("hero"); setSearchOpen(true); }} onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)} placeholder="Fahrer, LKW, Tour, Nachricht oder Funktion suchen …" aria-label="Portal durchsuchen" /><kbd>⌘ K</kbd></label>
                        {searchOpen && searchSource === "hero" ? renderSearchResults() : null}
                      </div>
                    </div>
                    {currentUser.role === "management" && !currentUser.readOnly ? <SetupGuide staff={data.staff} vehicles={data.vehicles} planning={data.planning}
                      onAddStaff={() => openModal("staff")} onImport={() => setImportKind("staff")} onAddVehicle={() => openModal("vehicle")}
                      onPlan={() => { setSection("planning"); openModal("planning"); }}
                      onInvite={() => { setSection("staff"); setNotice("Beim Fahrer auf „Einladen“ tippen – der Link geht per WhatsApp raus."); }} /> : null}
                    <OfficeCharts staff={data.staff} planning={data.planning} expenses={data.expenses} payroll={data.payroll} employeeDocuments={data.employeeDocuments} open={(target) => setSection(target as Section)} />
                    <div className="smart-dashboard-grid">
                      <section className="panel today-routes-panel">
                        <div className="panel-title"><div><h2>Heute im Einsatz</h2><p>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())} · KW {kw}</p></div><button type="button" onClick={() => setSection("planning")}>Alle öffnen →</button></div>
                        <div className="today-route-list">{todayPlanning.length ? todayPlanning.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => setSection("planning")}><span className="route-time">{item.start_time || "06:00"}</span><span className="route-driver"><b>{item.driver_name || "Kein Fahrer"}</b> {item.driver_name ? <DriverPlanningRating metrics={lookupDriverRating(driverRatingMap, item.driver_name)} /> : null}<small>{item.company || "—"} · {item.location || "—"}</small></span><span className="route-vehicle">{item.license_plate || "Ohne Fahrzeug"}<small>{item.block_id || "Kein Block"}</small></span><Badge value={String(item.status || "planned")} /></button>) : <EmptyState icon="▦" title="Heute ist nichts geplant" hint="Legen Sie in der KW-Planung einen Einsatz für heute an." actionLabel="Zur KW-Planung" onAction={() => setSection("planning")} />}</div>
                      </section>
                      <section className="panel attention-center-panel">
                        <div className="panel-title"><div><h2>Aufmerksamkeit erforderlich</h2><p>Priorisiert nach Dringlichkeit</p></div><button type="button" onClick={() => setSection("tasks")}>Alle {unifiedTasks.length} öffnen →</button></div>
                        <div className="attention-action-list">
                          {unifiedTasks.slice(0, 5).map((task) => (
                            <button type="button" key={task.id} onClick={() => setSection(task.section)}><i className={task.priority === "urgent" ? "danger-dot" : "warning-dot"} /><span><b>{task.title}</b><small>{task.detail}</small></span><em>Öffnen</em></button>
                          ))}
                          {!unifiedTasks.length ? <EmptyState icon="✓" title="Alles erledigt" hint="Im Moment gibt es keine offenen Aufgaben." /> : null}
                        </div>
                      </section>
                    </div>
                  </>
                ))}
              {section === "driverFlow" && <DriverWorkflow planning={data.planning} operations={data.tripOperations} checklists={data.checklists} files={data.files} documents={data.tripDocuments} departureShifts={departureShifts} locale={locale} open={setSection} action={action} />}
              {section === "staff" && (
                <StaffList
                  rows={data.staff}
                  events={data.driverPerformance}
                  canRate={["management", "dispatcher"].includes(currentUser.role)}
                  showPay={currentUser.role !== "dispatcher"}
                  isManager={currentUser.role === "management"}
                  open={setSelectedStaff}
                  edit={(row) => openModal("staff", row)}
                  add={() => openModal("staff")}
                  action={action}
                />
              )}
              {section === "absences" && <AbsenceCalendar staff={data.staff} absences={data.absences} canEdit={["management", "dispatcher"].includes(currentUser.role)} action={action} />}
              {section === "vehicles" && (
                <div className="advanced-stack">
                  <VehicleFiles vehicles={data.vehicles} files={data.files} planning={data.planning} maintenance={data.maintenance} tracking={data.tracking} comments={data.vehicleComments} fuelCodes={data.fuelCodes} fuelStops={data.fuelStops} role={currentUser.role} locale={locale} reload={load} action={action} />
                  <MaintenanceCenter rows={data.maintenance} vehicles={data.vehicles} canEdit={["management", "dispatcher"].includes(currentUser.role)} action={action} />
                </div>
              )}
              {section === "tracking" && (
                <TruckTracking
                  rows={data.tracking}
                  vehicles={data.vehicles}
                  operations={data.tripOperations}
                  canManage={["management", "dispatcher"].includes(currentUser.role)}
                  locale={locale}
                  action={action}
                />
              )}
              {section === "planning" && (
                <Card title={isDriver ? `${t("myTours")} · KW ${kw}` : `Fahrerplanung ${year} · KW ${kw}`} subtitle={isDriver ? t("today") : undefined}>
                  {currentUser.role !== "driver" ? (
                    <div className="planning-tools">
                      <span>
                        Neuen Wochenplan erstellen oder die vorige Woche als
                        Vorlage übernehmen.
                      </span>
                      <button
                        onClick={() =>
                          action({
                            action: "copyPreviousWeek",
                            planningYear: year,
                            calendarWeek: kw,
                          })
                        }
                      >
                        Vorwoche kopieren
                      </button>
                    </div>
                  ) : null}
                  {currentUser.role !== "driver" ? <DepartureConfirmPanel shifts={departureShifts} /> : null}
                  {currentUser.role !== "driver" ? <PlanningAlerts rows={data.planning} staff={data.staff} vehicles={data.vehicles} employeeDocuments={data.employeeDocuments} tachograph={data.tachograph} departureShifts={departureShifts} absences={data.absences} year={year} kw={kw} /> : null}
                  {currentUser.role !== "driver" ? (
                    <DispatchBoard
                      rows={data.planning}
                      staff={data.staff}
                      vehicles={data.vehicles}
                      driverRatingMap={driverRatingMap}
                      departureShifts={departureShifts}
                      absences={data.absences}
                      year={year}
                      kw={kw}
                      assign={(row, type, value) =>
                        action({
                          action: "updatePlanning",
                          id: row.id,
                          planningYear: year,
                          calendarWeek: kw,
                          company: row.company,
                          driverName: type === "driver" ? value : row.driver_name,
                          location: row.location,
                          licensePlate: type === "vehicle" ? value : row.license_plate,
                          workDays: String(row.work_days || "1,2,3,4,5,6,7"),
                          startTime: row.start_time || "06:00",
                          blockId: row.block_id,
                          status: row.status,
                          comments: row.comments,
                        })
                      }
                      moveResource={(sourceId, targetId, type, value) =>
                        action({
                          action: "movePlanningResource",
                          sourceId,
                          targetId,
                          resourceType: type,
                          value,
                        })
                      }
                    />
                  ) : null}
                  <WeeklySchedule
                    rows={data.planning}
                    staff={active}
                    year={year}
                    kw={kw}
                    driverRatingMap={driverRatingMap}
                    departureShifts={departureShifts}
                    locale={isDriver ? locale : undefined}
                    showAvailability={currentUser.role !== "driver"}
                    canEdit={currentUser.role !== "driver"}
                    edit={(row) => openModal("planning", row)}
                    remove={(id) => action({ action: "deletePlanning", id })}
                    move={(row, day) => action({ action: "updatePlanning", id: row.id, planningYear: year, calendarWeek: kw, company: row.company, driverName: row.driver_name, location: row.location, licensePlate: row.license_plate, workDays: String(day), startTime: row.start_time || "06:00", blockId: row.block_id, status: row.status, comments: row.comments })}
                    openDriver={(row) => {
                      const person = data.staff.find((item) => String(item.id) === String(row.staff_id) || item.full_name === row.driver_name);
                      if (person) setSelectedStaff(person);
                    }}
                    openVehicle={openVehicleProfile}
                  />
                </Card>
              )}
              {section === "operations" && <TripExecutionCenter openChat={(row) => { setChatTripId(Number(row.id)); setChatContactKey(null); setSection("messages"); }} rows={data.tripOperations} documents={data.tripDocuments} messages={data.tripMessages} driver={currentUser.role === "driver"} currentUserId={currentUser.id} chatModerator={["management", "dispatcher"].includes(currentUser.role)} locale={locale} action={action} reload={load} />}
              {section === "messages" && <TripExecutionCenter rows={data.tripOperations} documents={data.tripDocuments} messages={data.tripMessages} contacts={data.chatContacts} directMessages={data.directMessages} driver={currentUser.role === "driver"} currentUserId={currentUser.id} chatModerator={["management", "dispatcher"].includes(currentUser.role)} locale={locale} action={action} reload={reloadQuietly} view="chat" initialTripId={chatTripId} initialContactKey={chatContactKey} key={`${chatTripId ?? ""}-${chatContactKey ?? "inbox"}`} />}
              {section === "tachograph" && <TachographCenter rows={data.tachograph} staff={active} vehicles={data.vehicles} canEdit={["management", "dispatcher"].includes(currentUser.role)} locale={locale} action={action} />}
              {section === "expenses" && <ExpenseCenter rows={data.expenses} staff={active} vehicles={data.vehicles} audit={data.audit} driver={currentUser.role === "driver"} canApprove={["management", "accountant"].includes(currentUser.role)} locale={locale} action={action} reload={load} />}
              {section === "checklists" && <ChecklistCenter rows={data.checklists} staff={active} vehicles={data.vehicles} planning={data.planning} driver={currentUser.role === "driver"} locale={locale} action={action} />}
              {section === "concerns" && (currentUser.role === "driver" ? (
                <DriverConcerns
                  rows={data.concerns}
                  year={year}
                  kw={kw}
                  locale={locale}
                  voiceMessages={data.voiceMessages}
                  planning={data.planning}
                  reload={load}
                  submit={action}
                />
              ) : (
                <div className="advanced-stack">
                  <Concerns rows={data.concerns} canEdit={currentUser.role !== "accountant"} edit={(r) => openModal("concern", r)} remove={(id) => action({ action: "deleteConcern", id })} />
                  {["management", "dispatcher"].includes(currentUser.role) ? <VoiceMessagesCenter rows={data.voiceMessages} action={action} /> : null}
                </div>
              ))}
              {section === "documents" && (
                <div className="advanced-stack">
                  <PayrollCenter rows={data.payroll} periods={data.payrollPeriods} workDays={data.workDays} staff={active} driver={currentUser.role === "driver"} management={currentUser.role === "management"} locale={locale} action={action} reload={load} />
                  <Documents rows={data.documents} staff={active} driver={currentUser.role === "driver"} locale={locale} canUpload={["management", "accountant"].includes(currentUser.role)} reload={load} />
                </div>
              )}
              {section === "personnel" && <EmployeeDocuments rows={data.employeeDocuments} staff={data.staff} audit={data.audit} driver={currentUser.role === "driver"} locale={locale} action={action} reload={load} />}
              {section === "tasks" && <TaskCenter tasks={unifiedTasks} open={setSection} />}
              {section === "notifications" && <NotificationsCenter rows={data.notifications} driver={currentUser.role === "driver"} locale={locale} action={action} />}
              {section === "users" && <UserManagement rows={data.portalUsers} staff={data.staff} resetRequests={data.resetRequests} action={action} />}
              {section === "security" && <SecurityCenter loginAudit={data.loginAudit} resetRequests={data.resetRequests} audit={data.audit} action={action} />}
              {section === "reports" && <ReportsCenter role={currentUser.role} year={year} kw={kw} staff={data.staff} vehicles={data.vehicles} payroll={data.payroll} />}
            </>
          )}
          </div>
        </div>
      </section>
      <ReadableLayout />
      {importKind ? <ImportDialog kind={importKind} close={() => setImportKind(null)} done={(message) => { setImportKind(null); setNotice(message); void load(true); }} /> : null}
      <AssistantWidget context={assistantContext} locale={locale} section={nav.find((item) => item.id === section)?.label || section} />
      <nav className="driver-bottom-nav" aria-label={isDriver ? t("workArea") : "Navigation"}>
        {(isDriver ? [
          ["driverFlow", "route", t("home")],
          ["messages", "chat", t("messages")],
          ["expenses", "receipt", t("receipts")],
        ] : currentUser.role === "accountant" ? [
          ["overview", "home", "Start"],
          ["expenses", "receipt", "Belege"],
          ["documents", "euro", "Lohn"],
        ] : [
          ["overview", "home", "Start"],
          ["planning", "calendar", "Planung"],
          ["messages", "chat", "Chats"],
        ] as Array<[Section, IconName, string]>).map(([id, icon, label]) => <button key={id} type="button" className={section === id ? "bottom-nav-active" : ""} onClick={() => setSection(id as Section)}><span><Icon name={icon as IconName} /></span><b>{label}</b>{id === "messages" && unreadChatCount ? <i>{Math.min(99, unreadChatCount)}</i> : null}</button>)}
        <button type="button" onClick={() => setMobileMenu(true)}><span><Icon name="more" /></span><b>{isDriver ? t("more", "Mehr") : "Mehr"}</b>{unreadNotificationCount ? <i>{Math.min(99, unreadNotificationCount)}</i> : null}</button>
      </nav>
      {settingsOpen ? <InterfaceSettings theme={theme} density={density} pinned={pinnedSections} sections={nav.filter((item) => item.roles.includes(currentUser.role))} setTheme={setTheme} setDensity={setDensity} setPinned={setPinnedSections} close={() => setSettingsOpen(false)} /> : null}
      {modal && (
        <Modal
          title={
            modal === "staff"
              ? editing
                ? "Mitarbeiter bearbeiten"
                : "Mitarbeiter einstellen"
              : modal === "vehicle"
                ? "Fahrzeug anlegen"
                : modal === "planning"
                  ? editing
                    ? `Einsatz bearbeiten · ${year} / KW ${kw}`
                    : `Planung ${year} · KW ${kw}`
                  : editing
                    ? "Anliegen bearbeiten"
                    : "Anliegen erfassen"
          }
          close={() => {
            setModal(null);
            setEditing(null);
          }}
        >
          <EntryForm
            kind={modal}
            kw={kw}
            staff={active}
            driverPerformance={data.driverPerformance}
            editing={editing}
            submit={(payload) => action({ ...payload, planningYear: year })}
          />
        </Modal>
      )}
      {selectedStaff && (
        <DriverDossier
          staff={selectedStaff}
          planning={data.planning}
          vehicles={data.vehicles}
          files={data.files}
          employeeDocuments={data.employeeDocuments}
          payroll={data.payroll}
          tripOperations={data.tripOperations}
          tripMessages={data.tripMessages}
          tripDocuments={data.tripDocuments}
          expenses={data.expenses}
          tachograph={data.tachograph}
          audit={data.audit}
          concerns={data.concerns}
          checklists={data.checklists}
          performance={data.driverPerformance}
          role={currentUser.role}
          action={action}
          openSection={(next) => { setSelectedStaff(null); setSection(next); }}
          openVehicle={(plate) => { setSelectedStaff(null); openVehicleProfile(plate); }}
          close={() => setSelectedStaff(null)}
        />
      )}
      {notice && (
        <div className="toast" onClick={() => setNotice("")}>
          <span>✓</span>
          {notice}
        </div>
      )}
      {currentUser.mustChangePassword ? <PasswordChange required done={() => location.reload()} /> : null}
    </main>
  );
}

function TaskCenter({ tasks, open }: { tasks: PortalTask[]; open: (section: Section) => void }) {
  const [filter, setFilter] = useState<"all" | PortalTask["priority"]>("all");
  const visible = filter === "all" ? tasks : tasks.filter((task) => task.priority === filter);
  return <div className="task-center">
    <div className="task-center-summary"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span>Alle Aufgaben</span><b>{tasks.length}</b></button><button className={filter === "urgent" ? "active" : ""} onClick={() => setFilter("urgent")}><span>Dringend</span><b>{tasks.filter((item) => item.priority === "urgent").length}</b></button><button className={filter === "warning" ? "active" : ""} onClick={() => setFilter("warning")}><span>Diese Woche</span><b>{tasks.filter((item) => item.priority === "warning").length}</b></button><button className={filter === "normal" ? "active" : ""} onClick={() => setFilter("normal")}><span>Geplant</span><b>{tasks.filter((item) => item.priority === "normal").length}</b></button></div>
    <section className="panel task-inbox"><div className="panel-title"><div><h2>Einheitlicher Arbeitsvorrat</h2><p>Prüfen, antworten, ersetzen, verlängern oder abschließen</p></div><span className="live-label">LIVE</span></div><div className="task-list">{visible.length ? visible.map((task) => <article key={task.id} className={`task-row priority-${task.priority}`}><i /><div><small>{task.owner}</small><h3>{task.title}</h3><p>{task.detail}</p></div><span>{task.due || (task.priority === "urgent" ? "Heute" : "Offen")}</span><button type="button" onClick={() => open(task.section)}>Bearbeiten →</button></article>) : <div className="task-zero"><span>✓</span><b>Keine offenen Aufgaben in diesem Filter</b><p>Alle erforderlichen Vorgänge sind bearbeitet.</p></div>}</div></section>
  </div>;
}

function DepartureConfirmBadge({ shift }: { shift?: DepartureShift }) {
  if (!shift || shift.status === "past") return null;
  if (shift.status === "confirmed") return <span className="departure-badge departure-confirmed">✓ Bestätigt</span>;
  if (shift.status === "overdue") return <span className="departure-badge departure-overdue">Ersatzfahrer suchen</span>;
  return <span className="departure-badge departure-pending">Abfahrt bestätigen</span>;
}

function DepartureConfirmPanel({ shifts }: { shifts: DepartureShift[] }) {
  const overdue = shifts.filter((shift) => shift.status === "overdue");
  if (!overdue.length) return null;
  return (
    <section className="departure-confirm-panel">
      <header>
        <span>!</span>
        <div>
          <b>{overdue.length} Abfahrten ohne Bestätigung</b>
          <small>Frist 12 Stunden vor Start überschritten — sofort Ersatzfahrer zuordnen</small>
        </div>
      </header>
      <div className="departure-confirm-list">
        {overdue.map((shift) => (
          <article key={shift.key}>
            <b>{shift.driverName}</b>
            <span>{shift.company || "Tour"} · Block {shift.blockId || "—"}</span>
            <small>{shift.shiftDate} · {shift.startTime} · {shift.licensePlate || "Ohne Fahrzeug"}</small>
            <em>Ersatzfahrer</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function DriverWorkflow({ planning, operations, checklists, files, documents, departureShifts, locale, open, action }: {
  planning: Row[];
  operations: Row[];
  checklists: Row[];
  files: Row[];
  documents: Row[];
  departureShifts: DepartureShift[];
  locale: DriverLocale;
  open: (section: Section) => void;
  action: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const copy = {
    de: { title: "Mein Arbeitstag", help: "Ein Schritt nach dem anderen — auch ohne Internet", confirm: "Abfahrt bestätigen", confirmed: "Abfahrt bestätigt", confirmHelp: "Bitte bis 12 Stunden vor Start bestätigen", trip: "Tour öffnen", check: "Fahrzeug prüfen", before: "Foto vor der Fahrt", nav: "Navigation starten", delivery: "Lieferung bestätigen", after: "Foto nach der Fahrt", docs: "Dokumente senden", next: "Nächster Schritt", done: "Erledigt", open: "Öffnen", none: "Noch keine Tour für diese Woche" },
    pl: { title: "Mój dzień pracy", help: "Krok po kroku — również bez internetu", confirm: "Potwierdź wyjazd", confirmed: "Wyjazd potwierdzony", confirmHelp: "Potwierdź do 12 godzin przed startem", trip: "Otwórz trasę", check: "Sprawdź pojazd", before: "Zdjęcie przed trasą", nav: "Uruchom nawigację", delivery: "Potwierdź dostawę", after: "Zdjęcie po trasie", docs: "Wyślij dokumenty", next: "Następny krok", done: "Gotowe", open: "Otwórz", none: "Brak trasy na ten tydzień" },
    uk: { title: "Мій робочий день", help: "Крок за кроком — навіть без інтернету", confirm: "Підтвердити виїзд", confirmed: "Виїзд підтверджено", confirmHelp: "Підтвердьте за 12 годин до старту", trip: "Відкрити рейс", check: "Перевірити авто", before: "Фото до рейсу", nav: "Запустити навігацію", delivery: "Підтвердити доставку", after: "Фото після рейсу", docs: "Надіслати документи", next: "Наступний крок", done: "Готово", open: "Відкрити", none: "На цей тиждень рейсу немає" },
    ru: { title: "Мой рабочий день", help: "Шаг за шагом — даже без интернета", confirm: "Подтвердить выезд", confirmed: "Выезд подтверждён", confirmHelp: "Подтвердите за 12 часов до старта", trip: "Открыть рейс", check: "Проверить машину", before: "Фото до рейса", nav: "Запустить навигацию", delivery: "Подтвердить доставку", after: "Фото после рейса", docs: "Отправить документы", next: "Следующий шаг", done: "Готово", open: "Открыть", none: "На эту неделю рейса пока нет" },
  }[locale];
  const plan = planning[0];
  const operation = operations.find((row) => String(row.planning_id) === String(plan?.id)) || operations[0];
  const plate = String(plan?.license_plate || operation?.license_plate || "");
  const nextShift = plan ? departureShiftForPlanning(departureShifts, plan.id) : undefined;
  const departureConfirmed = nextShift?.status === "confirmed";
  const steps = [
    { key: "confirm", label: departureConfirmed ? copy.confirmed : copy.confirm, done: departureConfirmed, section: "driverFlow" as Section, action: nextShift && !departureConfirmed ? () => void action({ action: "confirmDeparture", planningId: nextShift.planningId, shiftDate: nextShift.shiftDate }) : undefined },
    { key: "trip", label: copy.trip, done: Boolean(plan), section: "operations" as Section },
    { key: "check", label: copy.check, done: checklists.some((row) => String(row.license_plate) === plate && row.phase === "Vor Fahrt"), section: "checklists" as Section },
    { key: "before", label: copy.before, done: files.some((row) => String(row.license_plate) === plate && row.category === "before"), section: "vehicles" as Section },
    { key: "nav", label: copy.nav, done: ["Unterwegs", "Zugestellt"].includes(String(operation?.status)), section: "operations" as Section },
    { key: "delivery", label: copy.delivery, done: operation?.status === "Zugestellt", section: "operations" as Section },
    { key: "after", label: copy.after, done: files.some((row) => String(row.license_plate) === plate && row.category === "after"), section: "vehicles" as Section },
    { key: "docs", label: copy.docs, done: documents.some((row) => String(row.trip_operation_id) === String(operation?.id)), section: "operations" as Section },
  ];
  const nextIndex = Math.max(0, steps.findIndex((step) => !step.done));
  return <div className="driver-flow"><section className="driver-flow-hero"><small>{copy.help}</small><h2>{copy.title}</h2>{plan ? <div><b>{plan.start_time || "06:00"}</b><span>{plan.company || "Tour"} · {plate || "—"}</span><em>{plan.block_id || "Block —"}</em>{nextShift ? <DepartureConfirmBadge shift={nextShift} /> : null}</div> : <p>{copy.none}</p>}{nextShift && !departureConfirmed ? <p className="driver-flow-confirm-note">{copy.confirmHelp}</p> : null}</section><div className="driver-flow-progress"><i style={{ width: `${(steps.filter((step) => step.done).length / steps.length) * 100}%` }} /></div><ol className="driver-flow-steps">{steps.map((step, index) => <li key={step.key} className={`${step.done ? "flow-done" : ""} ${index === nextIndex ? "flow-current" : ""} ${step.key === "confirm" && nextShift?.status === "overdue" ? "flow-overdue" : ""}`}><span>{step.done ? "✓" : index + 1}</span><div><small>{index === nextIndex && !step.done ? copy.next : step.done ? copy.done : ""}</small><b>{step.label}</b></div>{step.action ? <button type="button" className="primary-button driver-flow-confirm-button" onClick={step.action}>{copy.confirm} →</button> : step.key === "nav" && operation?.delivery_address ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(operation.delivery_address))}`} target="_blank" rel="noreferrer">{copy.open} ↗</a> : <button type="button" onClick={() => open(step.section)}>{copy.open} →</button>}</li>)}</ol><div className="offline-workflow-note"><span>⌁</span><div><b>Offline bereit</b><p>Checklisten, Fotos, Abfahrtsbestätigung und Nachrichten werden lokal gespeichert und automatisch gesendet, sobald die Verbindung wieder da ist.</p></div></div></div>;
}

function InterfaceSettings({ theme, density, pinned, sections, setTheme, setDensity, setPinned, close }: { theme: ThemeMode; density: DensityMode; pinned: Section[]; sections: typeof nav; setTheme: (value: ThemeMode) => void; setDensity: (value: DensityMode) => void; setPinned: (value: Section[]) => void; close: () => void }) {
  return <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="interface-settings"><header><div><small>PERSÖNLICHE ANSICHT</small><h2>Interface anpassen</h2></div><button type="button" onClick={close}>×</button></header><section><h3>Farbschema</h3><div className="setting-options">{(["light", "dark", "system"] as ThemeMode[]).map((value) => <button key={value} className={theme === value ? "active" : ""} onClick={() => setTheme(value)}><span>{value === "light" ? "☀" : value === "dark" ? "●" : "◐"}</span>{value === "light" ? "Hell" : value === "dark" ? "Dunkel" : "System"}</button>)}</div></section><section><h3>Darstellungsgröße</h3><div className="setting-options density-options">{(["compact", "comfortable", "large"] as DensityMode[]).map((value) => <button key={value} className={density === value ? "active" : ""} onClick={() => setDensity(value)}>{value === "compact" ? "Kompakt" : value === "large" ? "Groß (empfohlen)" : "Komfortabel"}</button>)}</div></section><section><h3>Favoriten in der Navigation</h3><p>Wichtige Bereiche werden oben angeheftet.</p><div className="pinned-settings">{sections.map((item) => <label key={item.id}><input type="checkbox" checked={pinned.includes(item.id)} onChange={() => setPinned(pinned.includes(item.id) ? pinned.filter((id) => id !== item.id) : [...pinned, item.id])} /><span>★</span>{item.label}</label>)}</div></section><button className="primary-button" type="button" onClick={close}>Ansicht speichern</button></aside></div>;
}

const code39Patterns: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww",
  M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", "*": "nwnnwnwnn",
};

function FuelBarcode({ value }: { value: string }) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const sequence = `*${normalized}*`;
  return <div className="fuel-barcode" role="img" aria-label={`Kassencode ${normalized}`}>
    {Array.from(sequence).flatMap((character, characterIndex) => {
      const pattern = code39Patterns[character] || code39Patterns["-"];
      return [...pattern].map((width, index) => <i key={`${characterIndex}-${index}`} className={index % 2 === 0 ? "bar" : "gap"} style={{ width: width === "w" ? 5 : 2 }} />)
        .concat(<i key={`${characterIndex}-separator`} className="gap" style={{ width: 2 }} />);
    })}
  </div>;
}

function FuelProofImage({ src, alt }: { src: string; alt: string }) {
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} loading="lazy" />
  </>;
}

function VehicleFiles({
  vehicles,
  files,
  planning,
  maintenance,
  tracking,
  comments,
  fuelCodes,
  fuelStops,
  role,
  locale,
  reload,
  action,
}: {
  vehicles: Row[];
  files: Row[];
  planning: Row[];
  maintenance: Row[];
  tracking: Row[];
  comments: Row[];
  fuelCodes: Row[];
  fuelStops: Row[];
  role: PortalUser["role"];
  locale: DriverLocale;
  reload: () => Promise<void>;
  action: (payload: Record<string, unknown>) => Promise<void>;
}) {
  type VehicleTab = "overview" | "before" | "after" | "week" | "damage" | "tuev" | "driver" | "repairs" | "fuel" | "comments";
  const driver = role === "driver";
  const canManage = role === "management" || role === "dispatcher";
  const [selectedPlate, setSelectedPlate] = useState("");
  const [activeTab, setActiveTab] = useState<VehicleTab>("overview");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [renderedAt] = useState(() => Date.now());
  const c = {
    de: { title: "Mein Fahrzeug · Fotos und Dokumente", plate: "Kennzeichen wählen", before: "Vor Fahrt", after: "Nach Fahrt", damage: "Schäden", docs: "Fahrzeugdokument", note: "Notiz", upload: "Hochladen", empty: "Noch keine Fotos oder Dokumente.", fleet: "Gesamter Fuhrpark", search: "Kennzeichen, Firma oder Standort suchen", overview: "Übersicht", tuev: "TÜV / HU / SP", assigned: "Fahrer", repairs: "Reparaturen" },
    pl: { title: "Mój pojazd · zdjęcia i dokumenty", plate: "Wybierz pojazd", before: "Przed trasą", after: "Po trasie", damage: "Uszkodzenia", docs: "Dokument pojazdu", note: "Notatka", upload: "Wyślij", empty: "Brak zdjęć i dokumentów.", fleet: "Cała flota", search: "Szukaj numeru, firmy lub lokalizacji", overview: "Przegląd", tuev: "TÜV / HU / SP", assigned: "Kierowca", repairs: "Naprawy" },
    uk: { title: "Моя вантажівка · фото та документи", plate: "Виберіть авто", before: "Перед рейсом", after: "Після рейсу", damage: "Пошкодження", docs: "Документ авто", note: "Примітка", upload: "Завантажити", empty: "Фото та документів ще немає.", fleet: "Увесь автопарк", search: "Пошук номера, компанії або бази", overview: "Огляд", tuev: "TÜV / HU / SP", assigned: "Водій", repairs: "Ремонти" },
    ru: { title: "Мой грузовик · фото и документы", plate: "Выберите машину", before: "До рейса", after: "После рейса", damage: "Повреждения", docs: "Документ машины", note: "Заметка", upload: "Загрузить", empty: "Фото и документов пока нет.", fleet: "Весь автопарк", search: "Поиск номера, компании или базы", overview: "Обзор", tuev: "TÜV / HU / SP", assigned: "Водитель", repairs: "Ремонты" },
  }[locale];
  const plates = useMemo(() => Array.from(
    new Set([
      ...vehicles.map((v) => String(v.license_plate)),
      ...planning.map((p) => String(p.license_plate || "")).filter(Boolean),
    ]),
  ), [planning, vehicles]);
  const fleetRows = vehicles.length ? vehicles : plates.map((licensePlate, index) => ({ id: `planned-${index}`, license_plate: licensePlate, status: "active" }));
  const effectivePlate = selectedPlate || String(fleetRows[0]?.license_plate || "");
  const selectedVehicle = fleetRows.find((vehicle) => String(vehicle.license_plate) === effectivePlate);
  const selectedFiles = files.filter((file) => String(file.license_plate) === effectivePlate);
  const selectedMaintenance = maintenance.filter((entry) => String(entry.license_plate) === effectivePlate);
  const selectedTracking = tracking.find((entry) => String(entry.license_plate) === effectivePlate);
  const selectedComments = comments.filter((entry) => String(entry.license_plate) === effectivePlate);
  const selectedFuelCodes = fuelCodes.filter((entry) => String(entry.license_plate) === effectivePlate && Number(entry.active ?? 1));
  const selectedFuelStops = fuelStops.filter((entry) => String(entry.license_plate) === effectivePlate);
  const assignments = planning.filter((plan) => String(plan.license_plate || "") === effectivePlate);
  const activeAssignment = assignments.find((plan) => plan.driver_name) || assignments[0];
  const filteredFleet = fleetRows.filter((vehicle) => {
    const assignment = planning.find((plan) => String(plan.license_plate || "") === String(vehicle.license_plate));
    const text = [vehicle.license_plate, vehicle.company, vehicle.location, vehicle.status, assignment?.driver_name].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const fileCount = (plate: unknown, category?: string) => files.filter((file) => String(file.license_plate) === String(plate) && (!category || file.category === category)).length;
  const categoryLabel = (category: unknown) => ({ before: c.before, after: c.after, week_start: "Wochenbeginn", week_end: "Wochenende", odometer: "Kilometerstand", damage: c.damage, accident: "Unfall", tuev: c.tuev, document: c.docs }[String(category)] || String(category));
  const formatDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("de-DE") : "—";
  const daysUntilInspection = selectedVehicle?.inspection_due ? Math.ceil((new Date(String(selectedVehicle.inspection_due)).getTime() - renderedAt) / 86400000) : null;
  const statusLabel = (value: unknown) => ({ active: "Aktiv", workshop: "Werkstatt", reserve: "Reserve" }[String(value)] || String(value || "—"));
  const latestFuelStop = selectedFuelStops[0];
  const odometer = selectedTracking?.odometer_km || latestFuelStop?.odometer_km || null;
  const odometerSource = selectedTracking?.odometer_km ? `${selectedTracking.provider || "GPS"} · ${formatDate(selectedTracking.recorded_at)}` : latestFuelStop?.odometer_km ? `Tanknachweis · ${formatDate(latestFuelStop.refueled_at)}` : "Fleetboard oder Foto fehlt";
  const plannedMaintenance = [...selectedMaintenance]
    .filter((entry) => !["Erledigt", "Freigegeben"].includes(String(entry.status)))
    .sort((left, right) => String(left.due_date || "9999").localeCompare(String(right.due_date || "9999")))[0];
  const weekStartCount = selectedFiles.filter((file) => file.category === "week_start").length;
  const weekEndCount = selectedFiles.filter((file) => file.category === "week_end").length;
  const tabs: Array<{ id: VehicleTab; label: string; count?: number }> = [
    { id: "overview", label: c.overview },
    { id: "before", label: c.before, count: selectedFiles.filter((file) => file.category === "before").length },
    { id: "after", label: c.after, count: selectedFiles.filter((file) => file.category === "after").length },
    { id: "week", label: "Wochenfotos", count: selectedFiles.filter((file) => ["week_start", "week_end", "odometer"].includes(String(file.category))).length },
    { id: "damage", label: c.damage, count: selectedFiles.filter((file) => file.category === "damage").length },
    { id: "tuev", label: c.tuev, count: selectedFiles.filter((file) => file.category === "tuev").length },
    { id: "fuel", label: "Tankvorgänge", count: selectedFuelStops.length },
    { id: "driver", label: c.assigned, count: assignments.length },
    { id: "repairs", label: c.repairs, count: selectedMaintenance.length },
    { id: "comments", label: "Kommentare", count: selectedComments.length },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlate = params.get("vehicle");
    const requestedTab = params.get("vehicleTab") as VehicleTab | null;
    const syncDeepLink = window.setTimeout(() => {
      if (requestedPlate && plates.includes(requestedPlate)) setSelectedPlate(requestedPlate);
      if (requestedTab && ["overview", "before", "after", "week", "damage", "tuev", "driver", "repairs", "fuel", "comments"].includes(requestedTab)) setActiveTab(requestedTab);
    }, 0);
    return () => window.clearTimeout(syncDeepLink);
  }, [plates]);

  function openVehicle(licensePlate: string) {
    setSelectedPlate(licensePlate);
    setActiveTab("overview");
  }

  function fileGallery(items: Row[], emptyText = c.empty) {
    return items.length ? <div className="vehicle-photo-gallery">{items.map((file) => {
      const imageFile = String(file.content_type || "").startsWith("image/");
      return <a key={file.id} className="vehicle-photo-card" href={`/api/vehicle-files/${file.id}`} target="_blank" rel="noreferrer">
        <div className="vehicle-photo-preview">{imageFile ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/vehicle-files/${file.id}`} alt={`${categoryLabel(file.category)} · ${file.license_plate}`} loading="lazy" />
        </> : <span>PDF</span>}<b>{categoryLabel(file.category)}</b></div>
        <div className="vehicle-photo-meta"><strong>{file.file_name}</strong><span>{formatDate(file.created_at)} · {file.driver_name || "Fahrer"}</span><small>{file.notes || "Keine Notiz"}</small></div>
      </a>;
    })}</div> : <div className="vehicle-record-empty"><span>▧</span><strong>{emptyText}</strong><small>Neue Uploads des Fahrers erscheinen hier automatisch.</small></div>;
  }

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const formData = new FormData(form);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const r = await fetch("/api/vehicle-files", { method: "POST", body: formData });
      if (!r.ok) return alert((await r.json()).error);
      form.reset(); setShowUpload(false); await reload();
    } catch {
      await queueOfflineUpload("/api/vehicle-files", formData); form.reset();
      alert(driver ? "Фотография сохранена без интернета и отправится автоматически." : "Datei offline gespeichert und wird automatisch synchronisiert.");
    }
  }
  async function uploadFuel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const response = await fetch("/api/fuel-stops", { method: "POST", body: new FormData(form) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Tankvorgang konnte nicht gespeichert werden");
    form.reset();
    setShowFuelForm(false);
    await reload();
  }
  return (
    <div className="vehicle-registry">
      <section className="vehicle-registry-hero">
        <div><small>FLOTTENZENTRALE</small><h2>{driver ? c.title : "Digitale Fahrzeugakte"}</h2><p>{driver ? "Fotos, Kontrollen und Dokumente zu meinem Fahrzeug" : "Alle Fahrzeuge, Fahrerzuordnung, Fotos, Prüfungen und Werkstattvorgänge an einem Ort"}</p></div>
        <div className="vehicle-registry-kpis"><span><b>{fleetRows.length}</b> Fahrzeuge</span><span><b>{fleetRows.filter((vehicle) => vehicle.status === "active").length}</b> einsatzbereit</span><span className={fleetRows.some((vehicle) => vehicle.status === "workshop") ? "has-warning" : ""}><b>{fleetRows.filter((vehicle) => vehicle.status === "workshop").length}</b> Werkstatt</span><span><b>{files.length}</b> Dateien</span></div>
      </section>

      <section className="vehicle-fleet-panel">
        <header className="vehicle-fleet-toolbar"><div><h3>{driver ? c.title : c.fleet}</h3><p>{filteredFleet.length} von {fleetRows.length} Fahrzeugen</p></div>{!driver ? <label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c.search} /></label> : null}</header>
        <div className="vehicle-fleet-grid">{filteredFleet.length ? filteredFleet.map((vehicle) => {
          const plate = String(vehicle.license_plate);
          const assignment = planning.find((plan) => String(plan.license_plate || "") === plate);
          const lastFile = files.find((file) => String(file.license_plate) === plate);
          return <button type="button" key={vehicle.id} className={`vehicle-fleet-card status-${String(vehicle.status || "active")} ${plate === effectivePlate ? "vehicle-fleet-card-active" : ""}`} onClick={() => openVehicle(plate)}>
            <span className="vehicle-card-symbol">▰</span><div className="vehicle-card-main"><small>{vehicle.company || "Ohne Firma"}</small><strong>{plate}</strong><span>{vehicle.location || "Kein Standort"} · {assignment?.driver_name || "Kein Fahrer"}</span></div><div className="vehicle-card-side"><Badge value={String(vehicle.status || "active")} /><b>{fileCount(plate)} Dateien</b><small>{lastFile ? `Neu ${formatDate(lastFile.created_at)}` : "Keine Uploads"}</small></div>
          </button>;
        }) : <div className="vehicle-record-empty"><span>⌕</span><strong>Kein Fahrzeug gefunden</strong><small>Suchbegriff ändern oder ein neues Fahrzeug anlegen.</small></div>}</div>
      </section>

      {selectedVehicle ? <section className="vehicle-record-panel">
        <header className="vehicle-record-header"><div className="vehicle-record-title"><span>▰</span><div><small>{selectedVehicle.company || "Fahrzeugakte"}</small><h2>{selectedVehicle.license_plate}</h2><p>{selectedVehicle.location || "Standort nicht hinterlegt"} · {activeAssignment?.driver_name || "Kein Fahrer zugeordnet"}</p></div></div><div className="vehicle-record-status"><Badge value={String(selectedVehicle.status || "active")} /><span>{selectedFiles.length} Dateien</span>{driver ? <button type="button" className="vehicle-add-proof" onClick={() => setShowUpload((value) => !value)}>＋ Foto hinzufügen</button> : null}</div></header>

        {driver && showUpload ? <form className="upload-form vehicle-upload-form" onSubmit={upload}>
          <select name="licensePlate" required defaultValue={effectivePlate}><option value="">{c.plate}</option>{plates.map((plate) => <option key={plate}>{plate}</option>)}</select>
          <select name="category" required defaultValue="week_start"><option value="week_start">Wochenbeginn · LKW + Kilometerstand</option><option value="week_end">Wochenende · LKW + Kilometerstand</option><option value="before">{c.before}</option><option value="after">{c.after}</option><option value="odometer">Kilometerstand</option><option value="damage">{c.damage}</option><option value="accident">Unfall</option><option value="tuev">TÜV / HU / SP</option><option value="document">{c.docs}</option></select>
          <input name="notes" placeholder={c.note} />
          <input name="file" type="file" accept="image/*,application/pdf" capture="environment" required />
          <button className="primary-button">{c.upload}</button>
        </form> : !driver ? <div className="viewer-note vehicle-viewer-note">Die Fahrzeugfotos werden von den Fahrern hochgeladen. Management und Disposition sehen neue Aufnahmen sofort in der passenden Fahrzeugakte.</div> : null}

        <nav className="vehicle-record-tabs" aria-label="Fahrzeugakte Bereiche">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}{tab.count !== undefined ? <span>{tab.count}</span> : null}</button>)}</nav>

        <div className="vehicle-record-content">
          {activeTab === "overview" ? <div className="vehicle-overview">
            <div className="vehicle-overview-grid"><div><span>Status</span><strong>{statusLabel(selectedVehicle.status)}</strong><small>{selectedVehicle.status === "workshop" ? "Derzeit nicht einplanen" : "Für die Disposition verfügbar"}</small></div><div><span>Aktueller Fahrer</span><strong>{activeAssignment?.driver_name || "Nicht zugeordnet"}</strong><small>{activeAssignment?.block_id ? `Block ${activeAssignment.block_id}` : "Kein aktiver Block"}</small></div><div className={daysUntilInspection !== null && daysUntilInspection <= 60 ? "overview-warning" : ""}><span>TÜV / HU / SP</span><strong>{formatDate(selectedVehicle.inspection_due)}</strong><small>{daysUntilInspection === null ? "Termin fehlt" : daysUntilInspection < 0 ? "Prüfung abgelaufen" : `${daysUntilInspection} Tage verbleibend`}</small></div><div><span>Aktueller Kilometerstand</span><strong>{odometer ? `${Number(odometer).toLocaleString("de-DE")} km` : "—"}</strong><small>{odometerSource}</small></div><div className={!weekStartCount || !weekEndCount ? "overview-warning" : ""}><span>Wochennachweis</span><strong>{weekStartCount} / {weekEndCount}</strong><small>Beginn / Ende der Woche</small></div><div><span>Nächste Wartung</span><strong>{plannedMaintenance ? formatDate(plannedMaintenance.due_date) : "Keine offene"}</strong><small>{plannedMaintenance?.description || "Fahrzeug freigegeben"}</small></div></div>
            <div className="vehicle-master-data"><div><span>Firma</span><b>{selectedVehicle.company || "—"}</b></div><div><span>Standort</span><b>{selectedVehicle.location || "—"}</b></div><div><span>Planungsbeginn</span><b>{activeAssignment?.start_time || "—"}</b></div><div><span>Manager-Notiz</span><b>{selectedVehicle.notes || "Keine Notiz"}</b></div></div>
            {canManage ? <form className="vehicle-admin-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action({ action: "updateVehicle", licensePlate: effectivePlate, company: form.get("company"), location: form.get("location"), status: form.get("status"), inspectionDue: form.get("inspectionDue"), notes: form.get("notes") }); }}><label>Firma<input name="company" defaultValue={String(selectedVehicle.company || "")} /></label><label>Standort<input name="location" defaultValue={String(selectedVehicle.location || "")} /></label><label>Status<select name="status" defaultValue={String(selectedVehicle.status || "active")}><option value="active">Aktiv</option><option value="workshop">Werkstatt</option><option value="reserve">Reserve</option></select></label><label>TÜV / HU / SP<input name="inspectionDue" type="date" defaultValue={String(selectedVehicle.inspection_due || "").slice(0, 10)} /></label><label className="vehicle-admin-note">Aktuelle Fahrzeugnotiz<input name="notes" defaultValue={String(selectedVehicle.notes || "")} placeholder="z. B. Workshop Appointment / TÜV" /></label><button className="primary-button">Fahrzeugdaten speichern</button></form> : null}
            <div className="vehicle-content-heading"><div><small>LETZTE UPLOADS</small><h3>Aktuelle Fotos und Dokumente</h3></div><span>{selectedFiles.length}</span></div>{fileGallery(selectedFiles.slice(0, 6))}
          </div> : null}

          {activeTab === "before" ? <><div className="vehicle-content-heading"><div><small>VOR FAHRT</small><h3>Fahrzeugzustand vor dem Einsatz</h3></div><span>{fileCount(effectivePlate, "before")}</span></div>{fileGallery(selectedFiles.filter((file) => file.category === "before"), "Noch keine Fotos vor der Fahrt")}</> : null}
          {activeTab === "after" ? <><div className="vehicle-content-heading"><div><small>NACH FAHRT</small><h3>Fahrzeugzustand nach dem Einsatz</h3></div><span>{fileCount(effectivePlate, "after")}</span></div>{fileGallery(selectedFiles.filter((file) => file.category === "after"), "Noch keine Fotos nach der Fahrt")}</> : null}
          {activeTab === "week" ? <><div className="vehicle-content-heading"><div><small>WÖCHENTLICHE KONTROLLE</small><h3>LKW und Kilometerstand am Wochenbeginn und Wochenende</h3></div><span>{weekStartCount} / {weekEndCount}</span></div><div className="weekly-proof-summary"><div className={weekStartCount ? "complete" : "missing"}><span>{weekStartCount ? "✓" : "!"}</span><div><b>Wochenbeginn</b><small>{weekStartCount ? `${weekStartCount} Nachweis(e)` : "Foto des LKW und Kilometerstands fehlt"}</small></div></div><div className={weekEndCount ? "complete" : "missing"}><span>{weekEndCount ? "✓" : "!"}</span><div><b>Wochenende</b><small>{weekEndCount ? `${weekEndCount} Nachweis(e)` : "Foto des LKW und Kilometerstands fehlt"}</small></div></div></div>{fileGallery(selectedFiles.filter((file) => ["week_start", "week_end", "odometer"].includes(String(file.category))), "Noch keine Wochenfotos vorhanden")}</> : null}
          {activeTab === "damage" ? <><div className="vehicle-content-heading"><div><small>SCHADEN- UND UNFALLAKTE</small><h3>Schäden, Unfälle und Beweisfotos</h3></div><span>{selectedFiles.filter((file) => ["damage", "accident"].includes(String(file.category))).length}</span></div>{fileGallery(selectedFiles.filter((file) => ["damage", "accident"].includes(String(file.category))), "Keine Schaden- oder Unfallfotos vorhanden")}<div className="vehicle-inline-records">{selectedMaintenance.filter((entry) => /schaden|unfall|accident|damage/i.test(String(entry.category))).map((entry) => <article key={entry.id}><div><b>{entry.description}</b><span>{entry.responsible || "Noch nicht zugewiesen"}</span></div><Badge value={String(entry.status)} /></article>)}</div></> : null}
          {activeTab === "tuev" ? <><div className={`vehicle-inspection-banner ${daysUntilInspection !== null && daysUntilInspection <= 60 ? "inspection-warning" : ""}`}><div><small>NÄCHSTER PRÜFTERMIN</small><strong>{formatDate(selectedVehicle.inspection_due)}</strong></div><span>{daysUntilInspection === null ? "Termin hinterlegen" : daysUntilInspection < 0 ? "Abgelaufen" : `${daysUntilInspection} Tage`}</span></div>{fileGallery(selectedFiles.filter((file) => file.category === "tuev"), "Noch keine TÜV/HU/SP-Dokumente")}<div className="vehicle-inline-records">{selectedMaintenance.filter((entry) => /TÜV|HU|SP/i.test(String(entry.category))).map((entry) => <article key={entry.id}><div><b>{entry.description}</b><span>{formatDate(entry.due_date)} · {entry.responsible || "—"}</span></div><Badge value={String(entry.status)} /></article>)}</div></> : null}
          {activeTab === "driver" ? <><div className="vehicle-content-heading"><div><small>FAHRERZUORDNUNG</small><h3>Aktuelle Planung für {effectivePlate}</h3></div><span>{assignments.length}</span></div><div className="vehicle-assignment-list">{assignments.length ? assignments.map((assignment) => <article key={assignment.id}><span className="assignment-avatar">{String(assignment.driver_name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{assignment.driver_name || "Kein Fahrer"}</strong><p>{assignment.company || "—"} · {assignment.location || "—"}</p></div><div><b>{assignment.start_time || "06:00"}</b><small>{assignment.block_id || "Kein Block"}</small></div><Badge value={String(assignment.status || "planned")} /></article>) : <div className="vehicle-record-empty"><span>○</span><strong>Kein Fahrer zugeordnet</strong><small>Die Zuordnung erfolgt in der KW-Planung.</small></div>}</div></> : null}
          {activeTab === "repairs" ? <><div className="vehicle-content-heading"><div><small>WERKSTATTHISTORIE</small><h3>Reparaturen, Kosten und Verantwortliche</h3></div><span>{selectedMaintenance.length}</span></div><div className="vehicle-repair-list">{selectedMaintenance.length ? selectedMaintenance.map((entry) => <article key={entry.id}><div className="repair-symbol">⚒</div><div><small>{entry.category} · {formatDate(entry.due_date)}</small><strong>{entry.description}</strong><span>{entry.responsible || "Keine Werkstatt hinterlegt"}</span></div><div><b>{Number(entry.cost || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</b><Badge value={String(entry.status)} /></div></article>) : <div className="vehicle-record-empty"><span>✓</span><strong>Keine Werkstattvorgänge</strong><small>Neue Wartungen können im Formular unterhalb der Fahrzeugakte angelegt werden.</small></div>}</div></> : null}
          {activeTab === "fuel" ? <div className="fuel-center">
            <div className="vehicle-content-heading"><div><small>TANKEN & KASSENCODES</small><h3>Vollständiger Tanknachweis für {effectivePlate}</h3></div><span>{selectedFuelStops.length}</span></div>
            {driver || role === "management" ? <div className="fuel-code-grid">{(["diesel", "adblue"] as const).map((fuelType) => {
              const code = selectedFuelCodes.find((item) => item.fuel_type === fuelType);
              const key = `${effectivePlate}-${fuelType}`;
              const revealed = Boolean(revealedCodes[key]);
              return <article key={fuelType} className={`fuel-code-card fuel-${fuelType}`}><header><span>{fuelType === "diesel" ? "D" : "A"}</span><div><small>KASSENCODE</small><b>{fuelType === "diesel" ? "Diesel" : "AdBlue"}</b></div></header>{code ? <>{revealed ? <FuelBarcode value={String(code.code_value)} /> : <div className="fuel-code-hidden">•••• •••• ••••</div>}<strong>{revealed ? code.code_value : "Code geschützt"}</strong><div className="fuel-code-actions"><button type="button" onClick={() => setRevealedCodes((current) => ({ ...current, [key]: !revealed }))}>{revealed ? "Verbergen" : "Zum Scannen öffnen"}</button>{revealed ? <button type="button" onClick={() => void navigator.clipboard.writeText(String(code.code_value))}>Kopieren</button> : null}</div></> : <div className="fuel-code-missing">Noch nicht eingerichtet</div>}
                {role === "management" ? <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action({ action: "saveFuelCode", licensePlate: effectivePlate, fuelType, codeValue: form.get("codeValue") }); }}><input name="codeValue" defaultValue={String(code?.code_value || "")} placeholder="Kassencode eintragen" required /><button>Speichern</button></form> : null}
              </article>;
            })}</div> : null}
            {driver ? <><button type="button" className="fuel-new-button" onClick={() => setShowFuelForm((value) => !value)}>＋ Neuen Tankvorgang dokumentieren</button>{showFuelForm ? <form className="fuel-stop-form" onSubmit={uploadFuel}><div className="fuel-form-fields"><label>Tankstelle<input name="station" required placeholder="z. B. Shell Berlin" /></label><label>Zeitpunkt<input name="refueledAt" type="datetime-local" required /></label><label>Kilometerstand<input name="odometerKm" type="number" min="1" step="1" inputMode="numeric" required /></label><label>Diesel (Liter)<input name="dieselLiters" type="number" min="0" step="0.01" inputMode="decimal" /></label><label>AdBlue (Liter)<input name="adblueLiters" type="number" min="0" step="0.01" inputMode="decimal" /></label><label>Gesamtbetrag (€)<input name="grossAmount" type="number" min="0" step="0.01" inputMode="decimal" required /></label><label className="fuel-form-note">Notiz<input name="notes" placeholder="Zapfsäule, Besonderheiten ..." /></label></div><input type="hidden" name="licensePlate" value={effectivePlate} /><div className="fuel-photo-requirements"><label><b>1</b><span>LKW an der Tankstelle</span><input name="stationPhoto" type="file" accept="image/*" capture="environment" required /></label><label><b>2</b><span>Diesel-Zapfsäule</span><input name="dieselPhoto" type="file" accept="image/*" capture="environment" required /></label><label><b>3</b><span>AdBlue-Zapfsäule</span><input name="adbluePhoto" type="file" accept="image/*" capture="environment" required /></label><label><b>4</b><span>Kassenbeleg</span><input name="receiptPhoto" type="file" accept="image/*" capture="environment" required /></label></div><button className="primary-button">4 Fotos sicher an Buchhaltung senden</button></form> : null}</> : null}
            <div className="fuel-stop-list">{selectedFuelStops.length ? selectedFuelStops.map((stop) => <article className="fuel-stop-card" key={stop.id}><header><div><small>{formatDate(stop.refueled_at)} · {stop.driver_name || "Fahrer"}</small><strong>{stop.station}</strong><span>{Number(stop.odometer_km).toLocaleString("de-DE")} km · Diesel {Number(stop.diesel_liters || 0).toLocaleString("de-DE")} l · AdBlue {Number(stop.adblue_liters || 0).toLocaleString("de-DE")} l</span></div><div><b>{Number(stop.gross_amount || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</b><Badge value={String(stop.status)} /></div></header><div className="fuel-proof-grid">{(["station", "diesel", "adblue", "receipt"] as const).map((kind, index) => <a key={kind} href={`/api/fuel-stops/${stop.id}/${kind}`} target="_blank" rel="noreferrer"><FuelProofImage src={`/api/fuel-stops/${stop.id}/${kind}`} alt={`${["LKW an Tankstelle", "Diesel", "AdBlue", "Beleg"][index]} · ${effectivePlate}`} /><span>{["LKW + Tankstelle", "Diesel", "AdBlue", "Beleg"][index]}</span></a>)}</div>{stop.notes ? <p>{stop.notes}</p> : null}</article>) : <div className="vehicle-record-empty"><span>⛽</span><strong>Noch kein Tankvorgang</strong><small>Nach jeder Betankung sind vier Fotos Pflicht.</small></div>}</div>
          </div> : null}
          {activeTab === "comments" ? <div className="vehicle-comments"><div className="vehicle-content-heading"><div><small>LICENSE PLATE COMMENTS</small><h3>Manager-Kommentare zu {effectivePlate}</h3></div><span>{selectedComments.length}</span></div>{canManage ? <form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action({ action: "addVehicleComment", licensePlate: effectivePlate, comment: data.get("comment") }).then(() => form.reset()); }}><textarea name="comment" required minLength={2} placeholder="Wichtiger Hinweis für Disposition und Fahrzeugakte ..." /><button className="primary-button">Kommentar speichern</button></form> : null}<div className="vehicle-comment-list">{selectedComments.length ? selectedComments.map((comment) => <article key={comment.id}><span>{String(comment.author_name || "M").split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><header><b>{comment.author_name}</b><time>{String(comment.created_at || "").slice(0, 16).replace("T", " ")}</time></header><p>{comment.comment}</p></div></article>) : <div className="vehicle-record-empty"><span>◌</span><strong>Noch keine Kommentare</strong><small>Kommentare aus dem Planning Report werden hier zentral gespeichert.</small></div>}</div></div> : null}
        </div>
      </section> : <div className="vehicle-record-empty"><span>▰</span><strong>Noch kein Fahrzeug angelegt</strong><small>Legen Sie zuerst ein Fahrzeug mit Kennzeichen an.</small></div>}
    </div>
  );
}

const performanceLabels: Record<string, string> = {
  rating: "Bewertung",
  late: "Verspätung",
  no_show: "Nicht erschienen",
  accident: "Unfall",
  positive: "Lob / Pluspunkt",
  comment: "Kommentar",
};

type DriverMetrics = {
  rating: number;
  ratingCount: number;
  lastRating: Row | undefined;
  criteria?: Record<string, number>;
};

const ratingCriteria: { key: string; label: string }[] = [
  { key: "punctuality", label: "Pünktlichkeit" },
  { key: "care", label: "Sorgfalt & Ladung" },
  { key: "communication", label: "Kommunikation" },
  { key: "vehicle", label: "Zustand des Fahrzeugs" },
];

function computeDriverMetrics(staffId: string | number, events: Row[]): DriverMetrics {
  const ratingEvents = events.filter(
    (event) => String(event.staff_id) === String(staffId) && event.event_type === "rating" && Number(event.rating),
  );
  const ratingCount = ratingEvents.length;
  const rating = ratingCount ? ratingEvents.reduce((sum, event) => sum + Number(event.rating), 0) / ratingCount : 0;
  const sums: Record<string, { total: number; count: number }> = {};
  for (const event of ratingEvents) {
    try {
      const parsed = JSON.parse(String(event.criteria || "null")) as Record<string, number> | null;
      if (!parsed) continue;
      for (const { key } of ratingCriteria) if (parsed[key]) { sums[key] ??= { total: 0, count: 0 }; sums[key].total += Number(parsed[key]); sums[key].count += 1; }
    } catch { /* älteres Format ohne Kriterien */ }
  }
  const criteria = Object.keys(sums).length ? Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, value.total / value.count])) : undefined;
  return {
    rating,
    ratingCount,
    lastRating: ratingEvents[0],
    criteria,
  };
}

function StarRatingDisplay({ value, count }: { value: number; count?: number }) {
  if (!value) return <span className="stars-empty">☆☆☆☆☆</span>;
  const rounded = Math.round(value);
  return (
    <span className="stars-filled" title={count ? `${value.toFixed(1)} aus ${count} Bewertungen` : undefined}>
      {"★".repeat(rounded)}{"☆".repeat(5 - rounded)}
    </span>
  );
}

function buildDriverRatingByName(staff: Row[], events: Row[]) {
  const map = new Map<string, DriverMetrics>();
  for (const person of staff) {
    map.set(String(person.full_name), computeDriverMetrics(person.id, events));
  }
  return map;
}

function lookupDriverRating(map: Map<string, DriverMetrics>, driverName: unknown) {
  return map.get(String(driverName || "")) || { rating: 0, ratingCount: 0, lastRating: undefined };
}

function DriverPlanningRating({ metrics }: { metrics: DriverMetrics }) {
  if (!metrics.ratingCount) return null;
  return (
    <span className="planning-driver-rating" title={`${metrics.rating.toFixed(1)} aus ${metrics.ratingCount} Bewertung(en)`}>
      {metrics.rating.toFixed(1)} ★
    </span>
  );
}

function DriverDossier({
  staff,
  planning,
  vehicles,
  files,
  employeeDocuments,
  payroll,
  tripOperations,
  tripMessages,
  tripDocuments,
  expenses,
  tachograph,
  audit,
  concerns,
  checklists,
  performance,
  role,
  action,
  openSection,
  openVehicle,
  close,
}: {
  staff: Row;
  planning: Row[];
  vehicles: Row[];
  files: Row[];
  employeeDocuments: Row[];
  payroll: Row[];
  tripOperations: Row[];
  tripMessages: Row[];
  tripDocuments: Row[];
  expenses: Row[];
  tachograph: Row[];
  audit: Row[];
  concerns: Row[];
  checklists: Row[];
  performance: Row[];
  role: PortalUser["role"];
  action: (payload: Record<string, unknown>) => Promise<void>;
  openSection: (section: Section) => void;
  openVehicle: (plate: unknown) => void;
  close: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "performance" | "operations" | "documents" | "finance">("overview");
  const [dossierNow] = useState(() => new Date().getTime());
  const trips = planning.filter(
    (p) => String(p.staff_id) === String(staff.id) || p.driver_name === staff.full_name,
  );
  const plates = Array.from(
    new Set(trips.map((t) => String(t.license_plate || "")).filter(Boolean)),
  );
  const trucks = vehicles.filter((v) =>
    plates.includes(String(v.license_plate)),
  );
  const docs = files.filter((f) => String(f.staff_id) === String(staff.id) || f.driver_name === staff.full_name);
  const personnel = employeeDocuments.filter((f) => String(f.staff_id) === String(staff.id));
  const salary = payroll.filter((record) => String(record.staff_id) === String(staff.id));
  const operations = tripOperations.filter((row) => String(row.staff_id) === String(staff.id) || row.driver_name === staff.full_name);
  const operationIds = new Set(operations.map((row) => Number(row.id)));
  const messages = tripMessages.filter((row) => operationIds.has(Number(row.trip_operation_id)) || row.driver_name === staff.full_name);
  const operationDocuments = tripDocuments.filter((row) => operationIds.has(Number(row.trip_operation_id)) || String(row.staff_id) === String(staff.id));
  const driverExpenses = expenses.filter((row) => String(row.staff_id) === String(staff.id) || row.full_name === staff.full_name);
  const driverTachograph = tachograph.filter((row) => String(row.staff_id) === String(staff.id) || row.full_name === staff.full_name);
  const driverConcerns = concerns.filter((row) => String(row.staff_id) === String(staff.id) || row.driver_name === staff.full_name || row.full_name === staff.full_name);
  const driverChecks = checklists.filter((row) => String(row.staff_id) === String(staff.id) || row.full_name === staff.full_name);
  const driverAudit = audit.filter((row) => {
    const detail = String(row.details || "").toLowerCase();
    return detail.includes(String(staff.full_name || "").toLowerCase()) || detail.includes(`\"staffId\":${staff.id}`) || detail.includes(`\"staffId\":\"${staff.id}\"`);
  });
  const completedTrips = operations.filter((row) => row.status === "Zugestellt").length;
  const violations = driverTachograph.filter((row) => row.infringement || Number(row.remaining_minutes) <= 90);
  const expiring = personnel.filter((row) => row.expires_at && new Date(String(row.expires_at)).getTime() <= dossierNow + 60 * 86400000);
  const driverPerformance = performance.filter((row) => String(row.staff_id) === String(staff.id));
  const driverRatings = driverPerformance.filter((row) => row.event_type === "rating" && Number(row.rating));
  const averageRating = driverRatings.length ? driverRatings.reduce((sum, row) => sum + Number(row.rating), 0) / driverRatings.length : 0;
  const canViewFinance = role === "management" || role === "accountant";
  const dossierEmpty = (text: string) => <div className="dossier-empty">{text}</div>;
  return (
    <div className="modal-backdrop">
      <div className="dossier">
        <div className="dossier-hero">
          <div className="dossier-avatar">{String(staff.full_name || "F").split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
          <div className="dossier-identity">
            <small>FAHRER 360° · PERSONALNUMMER {staff.id}</small>
            <h2>{staff.full_name}</h2>
            <p>{staff.company || "Ohne Firma"} · {staff.location || "Kein Standort"} · {staff.system_type || "Systemart offen"}</p>
          </div>
          <div className="dossier-hero-actions">
            <Badge value={String(staff.status)} />
            {role === "management" ? <button type="button" className="dossier-payroll-action" onClick={() => openSection("documents")}>Lohn öffnen</button> : null}
            {role === "management" && staff.status === "active" ? <button type="button" className="dossier-archive-action" onClick={() => { if (confirm(`${staff.full_name} wirklich als ausgeschieden markieren? Der Login wird deaktiviert.`)) void action({ action: "archiveStaff", id: staff.id }).then(close); }}>Ausscheiden</button> : null}
            <a href={`/api/staff/${staff.id}/export`} target="_blank" rel="noreferrer">DSGVO-Export</a>
            <button type="button" onClick={close} aria-label="Dossier schließen">×</button>
          </div>
        </div>
        <div className="dossier-kpis">
          <div><span>Touren</span><b>{operations.length || trips.length}</b><small>{completedTrips} zugestellt</small></div>
          <div><span>Fahrzeug</span><b>{plates[0] || "—"}</b><small>{trucks[0]?.status || "Keine Zuordnung"}</small></div>
          <div className={expiring.length ? "kpi-warning" : ""}><span>Dokumente</span><b>{personnel.length}</b><small>{expiring.length} laufen bald ab</small></div>
          <div className={violations.length ? "kpi-danger" : ""}><span>Verstöße</span><b>{violations.length}</b><small>Tachograph / Ruhezeit</small></div>
          <div className={averageRating && averageRating < 3 ? "kpi-danger" : averageRating && averageRating < 4 ? "kpi-warning" : ""}><span>Bewertung</span><b>{averageRating ? `${averageRating.toFixed(1)}/5 ★` : "Noch offen"}</b><small>{driverRatings.length ? `${driverRatings.length} Bewertung(en) mit Kommentar` : "Noch keine Bewertung der Disposition"}</small></div>
          <div><span>Nachrichten</span><b>{messages.length}</b><small>{driverConcerns.length} Anliegen</small></div>
        </div>
        <div className="dossier-tabs" role="tablist">
          <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Übersicht</button>
          {role === "management" || role === "dispatcher" ? <button type="button" className={tab === "performance" ? "active" : ""} onClick={() => setTab("performance")}>Bewertung & Vorfälle</button> : null}
          <button type="button" className={tab === "operations" ? "active" : ""} onClick={() => setTab("operations")}>Touren & Kommunikation</button>
          <button type="button" className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Dokumente & Fotos</button>
          {canViewFinance ? <button type="button" className={tab === "finance" ? "active" : ""} onClick={() => setTab("finance")}>Finanzen & Verlauf</button> : null}
        </div>
        <div className="dossier-body">
          {tab === "overview" ? <>
            <div className="dossier-grid">
              <section><h3>Fahrerdaten</h3><p><span>Status</span><Badge value={String(staff.status)} /></p><p><span>Firma</span><b>{staff.company || "—"}</b></p><p><span>Standort / Base</span><b>{staff.location || "—"}</b></p><p><span>System / Kadenz</span><b>{staff.system_type || "—"}</b></p><p><span>Abwesenheit</span><b>{staff.vacation || "Keine"}</b></p>{canViewFinance ? <p><span>Vergütung</span><b>{staff.compensation || "—"}</b></p> : null}<p><span>Eintritt</span><b>{staff.hired_at || "—"}</b></p><p><span>Login</span><b>{staff.login_email || "Kein Zugang"}</b></p></section>
              <section><h3>Aktuelle Fahrzeugzuordnung</h3>{trucks.length ? trucks.map((vehicle) => <button type="button" className="dossier-truck dossier-truck-link" onClick={() => openVehicle(vehicle.license_plate)} key={vehicle.id}><span>▣</span><div><b>{vehicle.license_plate}</b><small>{vehicle.company || "—"} · {vehicle.location || "—"}</small></div><Badge value={String(vehicle.status || "active")} /></button>) : dossierEmpty("Für diese Woche ist kein Fahrzeug zugeordnet.")}</section>
            </div>
            <h3 className="dossier-title">Wochenplanung</h3>
            {trips.length ? <Planning rows={trips} openVehicle={openVehicle} /> : dossierEmpty("Für die ausgewählte Kalenderwoche gibt es keine Planung.")}
            <div className="dossier-mini-grid">
              <section><h3>Letzte Fahrzeug-Checks</h3>{driverChecks.slice(0, 4).map((row) => <p key={row.id}><span>{row.phase} · {row.license_plate}</span><Badge value={String(row.status)} /></p>)}{!driverChecks.length ? dossierEmpty("Noch keine Fahrzeug-Checks") : null}</section>
              <section><h3>Offene Anliegen</h3>{driverConcerns.slice(0, 4).map((row) => <p key={row.id}><span>{row.item_name || row.subject || "Fahreranliegen"}</span><Badge value={String(row.completion_status || row.status || "Neu")} /></p>)}{!driverConcerns.length ? dossierEmpty("Keine offenen Anliegen") : null}</section>
            </div>
          </> : null}

          {tab === "performance" ? <div className="dossier-performance">
            <div className="performance-summary"><div><small>BEWERTUNG DER DISPOSITION</small><strong>{averageRating ? averageRating.toFixed(1) : "—"}<span> / 5 ★</span></strong><p>{driverRatings.length ? `${driverRatings.length} Bewertung(en), jeweils mit Kommentar und verantwortlichem Dispatcher.` : "Noch keine Bewertung gespeichert."}</p></div><div><small>LETZTER KOMMENTAR</small><strong>{driverRatings[0]?.rating ? `${driverRatings[0].rating}/5 ★` : "—"}</strong><p>{driverRatings[0]?.notes || "Der letzte Bewertungskommentar erscheint hier."}</p></div><div><small>VORFÄLLE</small><strong>{driverPerformance.filter((row) => ["late", "no_show", "accident"].includes(String(row.event_type))).length}</strong><p>{driverPerformance.filter((row) => row.event_type === "late").length} verspätet · {driverPerformance.filter((row) => row.event_type === "no_show").length} nicht erschienen · {driverPerformance.filter((row) => row.event_type === "accident").length} Unfälle</p></div></div>
            <div className="dossier-section-head"><div><small>GEMEINSAMES DISPOSITIONSPROTOKOLL</small><h3>Bewertungen, Vorfälle und interne Kommentare</h3></div><span>{driverPerformance.length}</span></div>
            <div className="driver-event-history dossier-event-history">{driverPerformance.length ? driverPerformance.map((event) => <article key={event.id} className={`event-${event.event_type}`}><span>{event.event_type === "late" ? "◷" : event.event_type === "no_show" ? "×" : event.event_type === "accident" ? "!" : event.event_type === "positive" ? "+" : event.event_type === "rating" ? "★" : "●"}</span><div><header><b>{performanceLabels[String(event.event_type)] || event.event_type}</b>{event.rating ? <span>{event.rating}/5 ★</span> : null}</header><p>{event.notes || (event.minutes_late ? `${event.minutes_late} Minuten Verspätung` : "Ohne Zusatzkommentar")}</p><small>{event.event_date} · {event.created_by_name}</small></div><b>{event.event_type === "rating" ? `${event.rating}/5 ★` : performanceLabels[String(event.event_type)] || "Eintrag"}</b></article>) : dossierEmpty("Noch keine Bewertungen der Disposition")}</div>
          </div> : null}

          {tab === "operations" ? <div className="dossier-split">
            <section><div className="dossier-section-head"><div><small>TOUREN</small><h3>Operative Einsätze</h3></div><span>{operations.length}</span></div>{operations.length ? <div className="dossier-operation-list">{operations.map((row) => <article key={row.id}><header><b>{row.license_plate || "Ohne Kennzeichen"}</b><Badge value={String(row.status || "Geplant")} /></header><p>{row.pickup_address || row.location || "Start offen"} <span>→</span> {row.delivery_address || "Ziel offen"}</p><small>{row.block_id || "Kein Block"} · ETA {row.eta ? String(row.eta).slice(0, 16).replace("T", " ") : "offen"}</small>{row.delay_reason ? <em>{row.delay_reason}</em> : null}</article>)}</div> : dossierEmpty("Noch keine operativen Touren")}</section>
            <section><div className="dossier-section-head"><div><small>KOMMUNIKATION</small><h3>Nachrichten zum Fahrer</h3></div><span>{messages.length}</span></div>{messages.length ? <div className="dossier-message-list">{messages.slice(-12).reverse().map((row) => <article key={row.id}><div><b>{row.sender_name || row.sender_role}</b><time>{String(row.created_at || "").slice(0, 16).replace("T", " ")}</time></div><p>{row.body || (row.message_type === "voice" ? "🎙 Sprachnachricht" : "📷 Foto")}</p><small>{row.license_plate || "—"} · {row.block_id || "Kein Block"}</small></article>)}</div> : dossierEmpty("Noch keine Tour-Nachrichten")}</section>
          </div> : null}

          {tab === "documents" ? <>
            <div className="dossier-section-head"><div><small>GESCHÜTZTE PERSONALAKTE</small><h3>Mitarbeiterdokumente</h3></div><span>{personnel.length}</span></div>
            <div className="file-grid">{personnel.length ? personnel.map((file) => <a key={file.id} href={`/api/employee-documents/${file.id}`} target="_blank" rel="noreferrer"><b>{file.category}</b><span>Gültig bis {file.expires_at || "unbefristet"}</span><small>{file.file_name}</small></a>) : dossierEmpty("Noch keine Mitarbeiterdokumente")}</div>
            <div className="dossier-section-head"><div><small>FAHRZEUGAKTE</small><h3>Fotos vor/nach der Fahrt und Fahrzeugdokumente</h3></div><span>{docs.length}</span></div>
            <div className="file-grid">{docs.length ? docs.map((file) => <a key={file.id} href={`/api/vehicle-files/${file.id}`} target="_blank" rel="noreferrer"><b>{file.category}</b><span>{file.license_plate} · {String(file.created_at).slice(0, 10)}</span><small>{file.file_name}</small></a>) : dossierEmpty("Dieser Fahrer hat noch keine Fahrzeugfotos hochgeladen.")}</div>
            <div className="dossier-section-head"><div><small>TOURNACHWEISE</small><h3>Lieferung, Schaden und Unterschrift</h3></div><span>{operationDocuments.length}</span></div>
            <div className="file-grid">{operationDocuments.length ? operationDocuments.map((file) => <a key={file.id} href={`/api/trip-documents/${file.id}`} target="_blank" rel="noreferrer"><b>{file.category}</b><span>{file.license_plate || "Tourdokument"} · {String(file.created_at).slice(0, 10)}</span><small>{file.file_name}</small></a>) : dossierEmpty("Noch keine Tournachweise")}</div>
          </> : null}

          {tab === "finance" && canViewFinance ? <div className="dossier-split">
            <section><div className="dossier-section-head"><div><small>BUCHHALTUNG</small><h3>Lohn & Auslagen</h3></div><span>{salary.length + driverExpenses.length}</span></div><div className="dossier-finance-list">{salary.map((record) => <article key={`salary-${record.id}`}><div><b>Lohnabrechnung {record.period}</b><small>{record.payment_status || "In Vorbereitung"}</small></div><strong>{Number(record.net_amount || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong></article>)}{driverExpenses.map((record) => <article key={`expense-${record.id}`}><div><b>{record.category || "Ausgabe"} · {record.merchant || "Beleg"}</b><small>{record.expense_date} · {record.status}</small></div><strong>{Number(record.gross_amount || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong></article>)}{!salary.length && !driverExpenses.length ? dossierEmpty("Noch keine Finanzdaten") : null}</div></section>
            <section><div className="dossier-section-head"><div><small>COMPLIANCE</small><h3>Verstöße & Änderungshistorie</h3></div><span>{violations.length + driverAudit.length}</span></div><div className="dossier-timeline">{violations.map((row) => <article className="timeline-danger" key={`violation-${row.id}`}><i /><div><b>{row.infringement || "Restfahrzeit unter 90 Minuten"}</b><small>{row.record_date} · {row.license_plate}</small></div></article>)}{driverAudit.slice(0, 12).map((row) => <article key={`audit-${row.id}`}><i /><div><b>{row.action}</b><small>{String(row.created_at || "").slice(0, 16).replace("T", " ")} · {row.user_name || "System"}</small></div></article>)}{!violations.length && !driverAudit.length ? dossierEmpty("Keine Verstöße oder Änderungen vorhanden") : null}</div></section>
          </div> : null}
        </div>
      </div>
    </div>
  );
}
function DriverHome({
  person,
  planning,
  documents,
  year,
  kw,
  locale,
  pushState,
  enablePush,
  unreadCount,
  openSection,
}: {
  person?: Row;
  planning: Row[];
  documents: Row[];
  year: number;
  kw: number;
  locale: DriverLocale;
  pushState: "default" | "granted" | "denied" | "unsupported";
  enablePush: () => Promise<void>;
  unreadCount: number;
  openSection: (section: Section) => void;
}) {
  const t = (key: string, fallback?: string) => driverText(locale, key, fallback);
  if (!person)
    return (
      <div className="empty-state">
        <b>{t("noProfile")}</b>
        <br />
        {t("contactManagement")}
      </div>
    );
  return (
    <>
      <section className={`driver-push-card push-${pushState}`}>
        <div><span className="driver-push-icon">{pushState === "granted" ? "✓" : "●"}</span><div><strong>{t("pushTitle")}</strong><p>{pushState === "granted" ? t("pushReady") : t("pushText")}</p></div></div>
        {pushState !== "granted" && pushState !== "unsupported" ? <button type="button" onClick={enablePush}>{pushState === "denied" ? t("notificationsDenied") : t("notificationsEnable")}</button> : null}
      </section>
      <div className="driver-hero">
        <div>
          <small>{t("myPay")}</small>
          <strong>{person.compensation || t("notStored")}</strong>
          <span>
            {person.company} · {person.location}
          </span>
        </div>
        <div className="pay-breakdown">
          <p>
            <span>{t("systemType")}</span>
            <b>{person.system_type || "—"}</b>
          </p>
          <p>
            <span>{t("vacation")}</span>
            <b>{person.vacation || t("noVacation")}</b>
          </p>
          <p>
            <span>{t("plansThisWeek")} · KW {kw}</span>
            <b>{planning.length}</b>
          </p>
          <p>
            <span>{t("payslips")}</span>
            <b>{documents.length}</b>
          </p>
        </div>
      </div>
      <section className="driver-quick-panel">
        <div className="driver-quick-heading"><div><small>{t("quickActions")}</small><strong>{planning[0] ? `${planning[0].start_time || "06:00"} · ${planning[0].license_plate || "—"}` : t("noTrips")}</strong></div>{unreadCount ? <button type="button" onClick={() => openSection("notifications")}>{unreadCount} {t("alerts")}</button> : null}</div>
        <div className="driver-quick-actions">
          <button type="button" onClick={() => openSection("operations")}><span>➜</span><b>{t("openRoute")}</b></button>
          <button type="button" onClick={() => openSection("concerns")}><span>●</span><b>{t("sendVoice")}</b></button>
          <button type="button" onClick={() => openSection("expenses")}><span>▣</span><b>{t("uploadReceipt")}</b></button>
          <button type="button" onClick={() => openSection("checklists")}><span>✓</span><b>{t("vehicleCheck")}</b></button>
        </div>
      </section>
      <div className="dashboard-grid">
        <Card title={`${t("myTours")} · KW ${kw}`} subtitle={t("today")}>
          <WeeklySchedule
            rows={planning}
            staff={[person]}
            year={year}
            kw={kw}
            locale={locale}
          />
        </Card>
        <Card title={t("myProfile")} subtitle={t("today")}>
          <div className="driver-profile">
            <p>
              <span>{t("name")}</span>
              <b>{person.full_name}</b>
            </p>
            <p>
              <span>{t("company")}</span>
              <b>{person.company || "—"}</b>
            </p>
            <p>
              <span>{t("location")}</span>
              <b>{person.location || "—"}</b>
            </p>
            <p>
              <span>{t("status")}</span>
              <Badge value={String(person.status)} />
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="panel employee-panel">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <p>{subtitle || "Stand: heute"}</p>
        </div>
      </div>
      {children}
    </article>
  );
}
function StaffList({ rows, events, canRate, showPay, isManager, open, edit, add, action }: { rows: Row[]; events: Row[]; canRate: boolean; showPay: boolean; isManager: boolean; open: (row: Row) => void; edit: (row: Row) => void; add: () => void; action: (payload: Record<string, unknown>) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [sortByRating, setSortByRating] = useState(false);
  const [rating, setRating] = useState<Row | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({ punctuality: 5, care: 5, communication: 5, vehicle: 5 });
  const [formPerson, setFormPerson] = useState<Row | null>(null);
  const [invitePerson, setInvitePerson] = useState<Row | null>(null);
  const [formType, setFormType] = useState("certificate");
  const [formReason, setFormReason] = useState("");
  const stars = Math.round(ratingCriteria.reduce((sum, { key }) => sum + scores[key], 0) / ratingCriteria.length);
  const activeCount = rows.filter((row) => row.status === "active").length;
  const metricsOf = (person: Row) => computeDriverMetrics(person.id, events);
  const visible = rows.filter((row) => (status === "all" || (status === "active" ? row.status === "active" : row.status !== "active")) && `${row.full_name} ${row.company || ""} ${row.location || ""} ${row.system_type || ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((left, right) => sortByRating ? metricsOf(right).rating - metricsOf(left).rating || metricsOf(right).ratingCount - metricsOf(left).ratingCount : 0);
  const today = new Date().toISOString().slice(0, 10);
  return <div className="list-page">
    <div className="list-toolbar">
      <label className="list-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Firma oder Standort suchen …" /></label>
      <div className="view-switch">
        <button type="button" className={status === "active" ? "active" : ""} onClick={() => setStatus("active")}>Aktiv ({activeCount})</button>
        <button type="button" className={status === "archived" ? "active" : ""} onClick={() => setStatus("archived")}>Ausgeschieden</button>
        <button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Alle</button>
      </div>
      {canRate ? <button type="button" className={`sort-toggle${sortByRating ? " active" : ""}`} onClick={() => setSortByRating(!sortByRating)}>★ Beste Bewertung zuerst</button> : null}
    </div>
    {visible.length ? <div className="card-list">{visible.map((person) => (
      <article key={String(person.id)} className="person-card">
        <button type="button" className="person-main" onClick={() => open(person)}>
          <span className="person-avatar">{String(person.full_name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
          <span className="person-text"><b>{person.full_name}</b><small>{[person.company, person.location, person.system_type ? `System ${person.system_type}` : ""].filter(Boolean).join(" · ") || "Keine Angaben"}</small></span>
        </button>
        {canRate ? (() => { const metrics = metricsOf(person); return <span className="person-rating" title={metrics.ratingCount ? `${metrics.ratingCount} Bewertung(en)` : "Noch nicht bewertet"}>{metrics.ratingCount ? <><b>{metrics.rating.toFixed(1)}</b><StarRatingDisplay value={metrics.rating} count={metrics.ratingCount} />{metrics.criteria ? (() => { const weakest = ratingCriteria.map(({ key, label }) => ({ label, value: metrics.criteria?.[key] ?? 5 })).sort((left, right) => left.value - right.value)[0]; return weakest.value < 4 ? <em className="person-weak" title="Schwächster Bereich">⚠ {weakest.label} {weakest.value.toFixed(1)}</em> : null; })() : null}</> : <small>Nicht bewertet</small>}</span>; })() : null}
        {showPay ? <span className="person-pay">{person.compensation || "—"}</span> : null}
        <Badge value={String(person.status)} />
        {isManager || canRate ? <div className="person-actions">
          {isManager && person.status === "active" ? <button type="button" className="invite-action" onClick={() => setInvitePerson(person)}>{person.login_email ? "Neu einladen" : "Einladen"}</button> : null}
          {isManager ? <button type="button" className="edit-action" onClick={() => edit(person)}>Bearbeiten</button> : null}
          <details><summary aria-label="Mehr">⋯</summary><div>
            {canRate && person.status === "active" ? <button type="button" onClick={(event) => { (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); setRating(person); setScores({ punctuality: 5, care: 5, communication: 5, vehicle: 5 }); }}>★ Bewertung senden</button> : null}
            {isManager ? <button type="button" onClick={(event) => { (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); setFormPerson(person); setFormReason(""); }}>📄 Dokument erstellen</button> : null}
            {isManager ? <button type="button" onClick={() => action({ action: person.status === "active" ? "archiveStaff" : "restoreStaff", id: person.id })}>{person.status === "active" ? "Ausscheiden" : "Reaktivieren"}</button> : null}
            {isManager && person.status === "archived" ? <button type="button" className="delete-action" onClick={() => confirm("Endgültig löschen?") && action({ action: "deleteStaff", id: person.id })}>Löschen</button> : null}
          </div></details>
        </div> : null}
      </article>
    ))}</div> : rows.length ? <EmptyState icon="⌕" title="Niemand gefunden" hint="Suchbegriff ändern oder oben einen anderen Filter wählen." /> : <EmptyState icon="◉" title="Noch keine Mitarbeiter" hint="Legen Sie den ersten Mitarbeiter an, um Touren zu planen und Löhne zu berechnen." actionLabel={isManager ? "＋ Mitarbeiter einstellen" : undefined} onAction={add} />}
    {rating ? <div className="driver-event-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRating(null); }}>
      <form className="driver-event-modal driver-rating-modal" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void action({ action: "addDriverPerformance", staffId: rating.id, eventType: "rating", eventDate: form.get("eventDate"), rating: stars, criteria: scores, minutesLate: 0, notes: form.get("notes") }).then(() => setRating(null));
      }}>
        <header><div><small>BEWERTUNG SENDEN</small><h3>{rating.full_name}</h3><p>{rating.company || "—"} · {rating.location || "—"}</p></div><button type="button" onClick={() => setRating(null)}>×</button></header>
        <label>Datum<input name="eventDate" type="date" defaultValue={today} required /></label>
        <div className="criteria-list">
          {ratingCriteria.map(({ key, label }) => <div key={key} className="criteria-row"><span>{label}</span><div className="star-rating-input" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= scores[key] ? "active" : ""} onClick={() => setScores({ ...scores, [key]: value })} role="radio" aria-checked={scores[key] === value} aria-label={`${value} Sterne`}>★</button>)}</div></div>)}
          <div className="criteria-total">Gesamt: <b>{stars} von 5</b> · {stars === 5 ? "Sehr gut" : stars === 4 ? "Gut" : stars === 3 ? "Befriedigend" : stars === 2 ? "Verbesserungsbedarf" : "Kritisch"}</div>
        </div>
        <label className="event-comment">Kommentar zur Bewertung*<textarea name="notes" minLength={2} required placeholder="z. B. zuverlässig, pünktlich, gute Kommunikation …" /></label>
        <button className="primary-button">Bewertung senden</button>
        <small className="event-visibility">Sichtbar für Management und alle Dispatcher</small>
      </form>
    </div> : null}
    {invitePerson ? <InviteDialog person={{ id: String(invitePerson.id), full_name: String(invitePerson.full_name), login_email: invitePerson.login_email ? String(invitePerson.login_email) : null }} close={() => setInvitePerson(null)} /> : null}
    {formPerson ? <div className="driver-event-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormPerson(null); }}>
      <form className="driver-event-modal" onSubmit={(event) => {
        event.preventDefault();
        if (formType === "warning" && formReason.trim().length < 5) return;
        window.open(`/api/staff/${formPerson.id}/forms?type=${formType}${formType === "warning" ? `&reason=${encodeURIComponent(formReason)}` : ""}`, "_blank");
        setFormPerson(null);
      }}>
        <header><div><small>DOKUMENT ERSTELLEN</small><h3>{formPerson.full_name}</h3><p>PDF wird aus den Mitarbeiterdaten erzeugt</p></div><button type="button" onClick={() => setFormPerson(null)}>×</button></header>
        <label>Vorlage<select value={formType} onChange={(event) => setFormType(event.target.value)}><option value="certificate">Arbeitsbescheinigung</option><option value="contract">Arbeitsvertrag (Vorlage)</option><option value="warning">Abmahnung</option></select></label>
        {formType === "warning" ? <label className="event-comment">Grund der Abmahnung*<textarea value={formReason} onChange={(event) => setFormReason(event.target.value)} minLength={5} required placeholder="Was ist wann passiert? Sachlich und konkret beschreiben." /></label> : null}
        <button className="primary-button">PDF erstellen</button>
        <small className="event-visibility">Vorlagen bitte vor Verwendung rechtlich prüfen.</small>
      </form>
    </div> : null}
  </div>;
}

function Badge({ value }: { value: string }) {
  const map: Record<string, string> = {
    active: "Aktiv",
    archived: "Ausgeschieden",
    workshop: "Werkstatt",
    reserve: "Reserve",
    planned: "Geplant",
    attention: "Prüfen",
    vacation: "Urlaub",
    Neu: "Neu",
    "In Bearbeitung": "In Bearbeitung",
    Bestellt: "Bestellt",
    Erledigt: "Erledigt",
    New: "Neu",
    "Not delivered": "Neu",
    Delivered: "Erledigt",
  };
  const badgeClass = ["Neu", "New", "Not delivered"].includes(value)
    ? "badge-red"
    : [
          "archived",
          "attention",
          "workshop",
          "In Bearbeitung",
          "Bestellt",
        ].includes(value)
      ? "badge-amber"
      : "badge-mint";
  return <span className={`badge ${badgeClass}`}>{map[value] || value}</span>;
}
function Planning({
  rows,
  canEdit = false,
  edit,
  remove,
  openDriver,
  openVehicle,
  driverRatingMap,
}: {
  rows: Row[];
  canEdit?: boolean;
  edit?: (row: Row) => void;
  remove?: (id: number) => void;
  openDriver?: (row: Row) => void;
  openVehicle?: (plate: unknown) => void;
  driverRatingMap?: Map<string, DriverMetrics>;
}) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row.company || "Ohne Firma");
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  if (!rows.length) return <EmptyState icon="▦" title="Für diese Woche gibt es noch keine Planung" hint="Oben „Planung anlegen“ wählen oder die vorige Woche als Vorlage übernehmen." />;
  return (
    <div className="plan-board">
      {Array.from(groups.entries()).map(([company, items]) => (
        <section key={company} className="plan-group">
          <header><h3>{company}</h3><span>{items.length} {items.length === 1 ? "Einsatz" : "Einsätze"}</span></header>
          <div className="plan-list">
            {items.map((r) => {
              const days = rowDays(r);
              return (
                <article key={r.id} className={`plan-card${r.driver_name ? "" : " plan-card-open"}`}>
                  <div className="plan-time"><b>{r.start_time || "06:00"}</b><small>Beginn</small></div>
                  <div className="plan-main">
                    <div className="plan-driver">
                      {r.driver_name ? <span className="planning-driver-cell"><button type="button" className="staff-link planning-person-link" onClick={() => openDriver?.(r)} disabled={!openDriver}>{r.driver_name}</button>{driverRatingMap ? <DriverPlanningRating metrics={lookupDriverRating(driverRatingMap, r.driver_name)} /> : null}</span> : <span className="plan-nodriver">Kein Fahrer zugeteilt</span>}
                      <Badge value={String(r.status)} />
                    </div>
                    <div className="plan-meta">
                      {r.license_plate ? <button type="button" className="plate-link planning-plate-link" onClick={() => openVehicle?.(r.license_plate)} disabled={!openVehicle}>{String(r.license_plate)}</button> : <span>Kein Kennzeichen</span>}
                      {r.location ? <span>📍 {r.location}</span> : null}
                      {r.block_id ? <span>Block {r.block_id}</span> : null}
                    </div>
                    {r.comments ? <p className="plan-comment">{r.comments}</p> : null}
                  </div>
                  <div className="plan-days" aria-label="Arbeitstage">
                    {weekDayNames.map((name, index) => <i key={name} className={days.has(index + 1) ? "on" : ""} title={name}>{name.slice(0, 2)}</i>)}
                  </div>
                  {canEdit ? (
                    <div className="row-buttons plan-actions">
                      <button className="edit-action" onClick={() => edit?.(r)}>Bearbeiten</button>
                      <button className="delete-action" onClick={() => confirm("Planung löschen?") && remove?.(Number(r.id))}>Löschen</button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const weekDayNames = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

const localizedWeekDayNames: Record<DriverLocale, string[]> = {
  de: weekDayNames,
  pl: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
  uk: ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"],
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
};

function isoWeekDates(year: number, week: number, locale: DriverLocale = "de") {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(
    januaryFourth.getUTCDate() -
      ((januaryFourth.getUTCDay() + 6) % 7) +
      (week - 1) * 7,
  );
  return localizedWeekDayNames[locale].map((name, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return {
      number: index + 1,
      name,
      short: name.slice(0, 2),
      date: new Intl.DateTimeFormat(locale === "de" ? "de-DE" : locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "ru-RU", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      }).format(date),
    };
  });
}

function planDate(year: number, week: number, day: number) {
  const monday = new Date(Date.UTC(year, 0, 4));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (week - 1) * 7 + day - 1);
  return monday.toISOString().slice(0, 10);
}

function absenceOn(absences: Row[], staffId: unknown, date: string) {
  return absences.find((item) => String(item.staff_id) === String(staffId) && String(item.start_date) <= date && String(item.end_date) >= date);
}

function rowDays(row: Row) {
  const parsed = String(row.work_days || "1,2,3,4,5,6,7")
    .split(",")
    .map(Number)
    .filter((day) => day >= 1 && day <= 7);
  return new Set(parsed.length ? parsed : [1, 2, 3, 4, 5, 6, 7]);
}

function PlanningAlerts({
  rows,
  staff,
  vehicles,
  employeeDocuments,
  tachograph,
  departureShifts,
  absences,
  year,
  kw,
}: {
  rows: Row[];
  staff: Row[];
  vehicles: Row[];
  employeeDocuments: Row[];
  tachograph: Row[];
  departureShifts: DepartureShift[];
  absences: Row[];
  year: number;
  kw: number;
}) {
  const alerts: { key: string; level: "danger" | "warning"; text: string }[] =
    [];
  const seen = new Set<string>();
  const add = (key: string, level: "danger" | "warning", text: string) => {
    if (!seen.has(key)) {
      seen.add(key);
      alerts.push({ key, level, text });
    }
  };

  for (let day = 1; day <= 7; day++) {
    const daily = rows.filter((row) => rowDays(row).has(day));
    for (const row of daily) {
      const time = String(row.start_time || "06:00");
      if (row.driver_name) {
        const duplicates = daily.filter(
          (other) =>
            other.id !== row.id &&
            other.driver_name === row.driver_name &&
            String(other.start_time || "06:00") === time,
        );
        if (duplicates.length)
          add(
            `driver-${day}-${row.driver_name}-${time}`,
            "danger",
            `${weekDayNames[day - 1]} ${time}: ${row.driver_name} ist gleichzeitig zwei Einsätzen zugeordnet.`,
          );
        const driver = staff.find(
          (person) => person.full_name === row.driver_name,
        );
        const planDay = planDate(year, kw, day);
        const absent = driver ? absenceOn(absences, driver.id, planDay) : undefined;
        if (absent)
          add(
            `absent-${row.driver_name}-${day}`,
            "danger",
            `${weekDayNames[day - 1]} ${planDay.slice(8)}.${planDay.slice(5, 7)}.: ${row.driver_name} ist im ${absent.absence_type === "sick" ? "Krankenstand" : "Urlaub"} und trotzdem eingeplant.`,
          );
        for (const doc of employeeDocuments) {
          if (driver && String(doc.staff_id) === String(driver.id) && doc.expires_at && String(doc.expires_at) < planDay)
            add(`docplan-${doc.id}-${day}`, "danger", `${row.driver_name}: ${String(doc.category || "Dokument")} ist am ${planDay.slice(8)}.${planDay.slice(5, 7)}. bereits abgelaufen.`);
        }
        if (!driver || driver.status !== "active")
          add(
            `inactive-${row.driver_name}`,
            "danger",
            `Fahrer ${row.driver_name} ist ausgeschieden oder nicht aktiv.`,
          );
      }
      if (!row.license_plate) {
        add(
          `plate-${row.id}`,
          "warning",
          `${row.driver_name || "Einsatz"}: Kennzeichen fehlt.`,
        );
      } else {
        const duplicates = daily.filter(
          (other) =>
            other.id !== row.id &&
            other.license_plate === row.license_plate &&
            String(other.start_time || "06:00") === time,
        );
        if (duplicates.length)
          add(
            `vehicle-${day}-${row.license_plate}-${time}`,
            "danger",
            `${weekDayNames[day - 1]} ${time}: ${row.license_plate} ist mehreren Fahrern zugeordnet.`,
          );
        const vehicle = vehicles.find(
          (item) => item.license_plate === row.license_plate,
        );
        if (vehicle?.inspection_due && String(vehicle.inspection_due) < planDate(year, kw, day))
          add(`tuvplan-${row.license_plate}-${day}`, "danger", `${row.license_plate}: TÜV/HU ist am ${planDate(year, kw, day).slice(8)}.${planDate(year, kw, day).slice(5, 7)}. bereits abgelaufen.`);
        if (vehicle?.status === "workshop")
          add(
            `workshop-${row.license_plate}`,
            "danger",
            `${row.license_plate} befindet sich in der Werkstatt.`,
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
        daysLeft < 0 ? "danger" : "warning",
        daysLeft < 0
          ? `TÜV/HU/SP für ${vehicle.license_plate} ist seit ${Math.abs(daysLeft)} Tagen abgelaufen.`
          : `TÜV/HU/SP für ${vehicle.license_plate} läuft in ${daysLeft} Tagen ab.`,
      );
  }

  for (const doc of employeeDocuments) {
    if (!doc.expires_at) continue;
    const due = new Date(String(doc.expires_at));
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= 30) {
      const label = String(doc.category || doc.file_name || "Dokument");
      add(
        `doc-${doc.id}`,
        daysLeft < 0 ? "danger" : "warning",
        daysLeft < 0
          ? `${label} von ${doc.full_name || "Mitarbeiter"} ist abgelaufen.`
          : `${label} von ${doc.full_name || "Mitarbeiter"} läuft in ${daysLeft} Tagen ab.`,
      );
    }
  }

  const seenTacho = new Set<string>();
  for (const row of tachograph) {
    if (!row.infringement && Number(row.remaining_minutes) > 90) continue;
    const key = String(row.staff_id || row.full_name || row.id);
    if (seenTacho.has(key)) continue;
    seenTacho.add(key);
    const name = row.full_name || "Fahrer";
    add(
      `tacho-${row.id}`,
      row.infringement ? "danger" : "warning",
      row.infringement
        ? `Tachograph-Verstoß: ${name} · ${row.infringement}`
        : `Tachograph-Warnung: ${name} hat nur noch ${row.remaining_minutes} Min. Restlenkzeit.`,
    );
  }

  for (const shift of departureShifts.filter((item) => item.status === "overdue")) {
    add(
      `departure-${shift.key}`,
      "danger",
      `${shift.driverName}: Abfahrt ${shift.shiftDate} ${shift.startTime} nicht bestätigt — Ersatzfahrer suchen.`,
    );
  }
  for (const shift of departureShifts.filter((item) => item.status === "pending")) {
    add(
      `departure-pending-${shift.key}`,
      "warning",
      `${shift.driverName}: Abfahrt ${shift.shiftDate} ${shift.startTime} wartet auf Bestätigung (Frist 12h vor Start).`,
    );
  }

  return (
    <div
      className={`planning-alerts ${alerts.length ? "has-alerts" : "all-clear"}`}
    >
      <div className="alerts-title">
        <span>{alerts.length ? "!" : "✓"}</span>
        <div>
          <b>
            {alerts.length
              ? `${alerts.length} automatische Hinweise`
              : "Keine Konflikte erkannt"}
          </b>
          <small>
            Fahrer, Fahrzeuge, Kennzeichen, Abfahrtsbestätigung, Dokumente, Tachograph und Prüftermine werden automatisch
            geprüft.
          </small>
        </div>
      </div>
      {alerts.length ? (
        <div className="alert-list">
          {alerts.map((alert) => (
            <p className={alert.level} key={alert.key}>
              {alert.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DispatchBoard({
  rows,
  staff,
  vehicles,
  driverRatingMap,
  departureShifts,
  absences,
  year,
  kw,
  assign,
  moveResource,
}: {
  absences: Row[];
  year: number;
  kw: number;
  rows: Row[];
  staff: Row[];
  vehicles: Row[];
  driverRatingMap: Map<string, DriverMetrics>;
  departureShifts: DepartureShift[];
  assign: (row: Row, type: "driver" | "vehicle", value: string) => void | Promise<void>;
  moveResource: (sourceId: string | number, targetId: string | number, type: "driver" | "vehicle", value: string) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState<"driver" | "vehicle" | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const activeStaff = staff.filter((person) => person.status === "active");
  const usableVehicles = vehicles.filter((vehicle) => vehicle.status !== "workshop");
  const driverUse = (name: string) => rows.filter((row) => row.driver_name === name).length;
  const vehicleUse = (plate: string) => rows.filter((row) => row.license_plate === plate).length;
  const rowConflict = (row: Row) => rows.some((other) => {
    if (other.id === row.id) return false;
    const overlapping = [...rowDays(row)].some((day) => rowDays(other).has(day));
    if (!overlapping) return false;
    return Boolean(row.driver_name && other.driver_name === row.driver_name) || Boolean(row.license_plate && other.license_plate === row.license_plate);
  });
  const rowUnavailable = (row: Row) => {
    const driver = staff.find((person) => person.full_name === row.driver_name);
    const vehicle = vehicles.find((item) => item.license_plate === row.license_plate);
    return Boolean((row.driver_name && (!driver || driver.status !== "active")) || vehicle?.status === "workshop");
  };
  function startDrag(event: DragEvent, type: "driver" | "vehicle", value: string, sourceId?: string | number | null) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-logipay", JSON.stringify({ type, value, sourceId: sourceId || null }));
    setDragging(type);
  }
  async function drop(event: DragEvent, target: Row) {
    event.preventDefault();
    setDropTarget(null);
    setDragging(null);
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/x-logipay")) as { type: "driver" | "vehicle"; value: string; sourceId?: string | number | null };
      if (!payload.value || !["driver", "vehicle"].includes(payload.type)) return;
      if (payload.sourceId && String(payload.sourceId) !== String(target.id)) {
        await moveResource(payload.sourceId, target.id as string | number, payload.type, payload.value);
      } else await assign(target, payload.type, payload.value);
    } catch {
      setDropTarget(null);
    }
  }
  return (
    <section className="dispatch-board">
      <div className="dispatch-board-head">
        <div><small>LIVE-DISPOSITION</small><h3>Fahrer und Fahrzeuge per Drag & Drop zuordnen</h3><p>Element greifen und auf den gewünschten Einsatz ziehen. Konflikte werden sofort markiert.</p></div>
        <div className="dispatch-legend"><span><i className="legend-free" /> Verfügbar</span><span><i className="legend-used" /> Zugeordnet</span><span><i className="legend-danger" /> Konflikt</span></div>
      </div>
      <div className="dispatch-layout">
        <aside className="dispatch-pool">
          <header><span>◉</span><div><b>Fahrer</b><small>{activeStaff.length} aktiv</small></div></header>
          <div className="dispatch-pool-list">
            {activeStaff.map((person) => {
              const useCount = driverUse(String(person.full_name));
              const rating = lookupDriverRating(driverRatingMap, person.full_name);
              const weekAbsence = [1, 2, 3, 4, 5, 6, 7].map((day) => absenceOn(absences, person.id, planDate(year, kw, day))).find(Boolean);
              return <button type="button" draggable onDragStart={(event) => startDrag(event, "driver", String(person.full_name))} onDragEnd={() => setDragging(null)} className={`${useCount ? "pool-used" : "pool-free"}${weekAbsence ? " pool-absent" : ""}`} key={person.id}><span>{String(person.full_name || "F").split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><b>{person.full_name}</b><small>{weekAbsence ? `⚠ ${weekAbsence.absence_type === "sick" ? "Krank" : "Urlaub"} in dieser KW · ` : ""}{person.company || "—"} · {useCount ? `${useCount}× eingeplant` : "frei"}{rating.ratingCount ? ` · ${rating.rating.toFixed(1)} ★` : ""}</small></div><i>⋮⋮</i></button>;
            })}
            {staff.filter((person) => person.status !== "active").slice(0, 3).map((person) => <div className="pool-disabled" key={person.id}><span>×</span><div><b>{person.full_name}</b><small>Nicht aktiv</small></div></div>)}
          </div>
        </aside>
        <div className="dispatch-assignments">
          <header><div><b>Einsätze dieser Woche</b><small>{rows.length} Positionen · Zielbereich für Fahrer oder Fahrzeug</small></div><span>{dragging ? `${dragging === "driver" ? "Fahrer" : "Fahrzeug"} ablegen` : "Bereit"}</span></header>
          <div className="dispatch-assignment-list">
            {rows.length ? rows.map((row) => {
              const conflict = rowConflict(row);
              const unavailable = rowUnavailable(row);
              const target = dropTarget === String(row.id);
              const departureShift = departureShiftForPlanning(departureShifts, row.id);
              const departureOverdue = departureShift?.status === "overdue";
              return <article key={row.id} className={`${conflict ? "assignment-conflict" : ""} ${unavailable ? "assignment-unavailable" : ""} ${departureOverdue ? "assignment-departure-overdue" : ""} ${target ? "assignment-target" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(String(row.id)); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => void drop(event, row)}>
                <div className="assignment-route"><span>{row.start_time || "06:00"}</span><div><b>{row.company || "Ohne Firma"}</b><small>{row.location || "—"} · Block {row.block_id || "—"}</small></div></div>
                <div className="assignment-slots">
                  <div className={!row.driver_name ? "slot-empty" : ""}>{row.driver_name ? <button type="button" draggable onDragStart={(event) => startDrag(event, "driver", String(row.driver_name), row.id)} onDragEnd={() => setDragging(null)}><span>◉</span><b>{row.driver_name}</b><DriverPlanningRating metrics={lookupDriverRating(driverRatingMap, row.driver_name)} /></button> : <span>Fahrer hier ablegen</span>}{row.driver_name ? <button type="button" className="slot-clear" onClick={() => void assign(row, "driver", "")} aria-label="Fahrer entfernen">×</button> : null}</div>
                  <div className={!row.license_plate ? "slot-empty" : ""}>{row.license_plate ? <button type="button" draggable onDragStart={(event) => startDrag(event, "vehicle", String(row.license_plate), row.id)} onDragEnd={() => setDragging(null)}><span>▣</span><b>{row.license_plate}</b></button> : <span>Fahrzeug hier ablegen</span>}{row.license_plate ? <button type="button" className="slot-clear" onClick={() => void assign(row, "vehicle", "")} aria-label="Fahrzeug entfernen">×</button> : null}</div>
                </div>
                <div className="assignment-state">{departureOverdue ? <span className="state-danger">Ersatzfahrer</span> : conflict ? <span className="state-danger">Konflikt</span> : unavailable ? <span className="state-warning">Nicht verfügbar</span> : departureShift && departureShift.status !== "confirmed" ? <DepartureConfirmBadge shift={departureShift} /> : <span className="state-ok">Planbar</span>}<small>{String(row.work_days || "1,2,3,4,5,6,7").split(",").length} Tage</small></div>
              </article>;
            }) : <div className="dispatch-empty">Noch keine Einsätze. Legen Sie zuerst eine Planung an.</div>}
          </div>
        </div>
        <aside className="dispatch-pool">
          <header><span>▣</span><div><b>Fahrzeuge</b><small>{usableVehicles.length} verfügbar</small></div></header>
          <div className="dispatch-pool-list">
            {vehicles.map((vehicle) => {
              const workshop = vehicle.status === "workshop";
              const useCount = vehicleUse(String(vehicle.license_plate));
              return <button type="button" draggable={!workshop} disabled={workshop} onDragStart={(event) => startDrag(event, "vehicle", String(vehicle.license_plate))} onDragEnd={() => setDragging(null)} className={workshop ? "pool-disabled" : useCount ? "pool-used" : "pool-free"} key={vehicle.id}><span>▣</span><div><b>{vehicle.license_plate}</b><small>{workshop ? "In Werkstatt" : useCount ? `${useCount}× eingeplant` : `${vehicle.location || "—"} · frei`}</small></div><i>{workshop ? "!" : "⋮⋮"}</i></button>;
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function WeeklySchedule({
  rows,
  staff,
  year,
  kw,
  showAvailability = false,
  canEdit = false,
  edit,
  remove,
  move,
  openDriver,
  openVehicle,
  driverRatingMap,
  departureShifts,
  locale,
}: {
  rows: Row[];
  staff: Row[];
  year: number;
  kw: number;
  showAvailability?: boolean;
  canEdit?: boolean;
  edit?: (row: Row) => void;
  remove?: (id: number) => void;
  move?: (row: Row, day: number) => void;
  openDriver?: (row: Row) => void;
  openVehicle?: (plate: unknown) => void;
  driverRatingMap?: Map<string, DriverMetrics>;
  departureShifts?: DepartureShift[];
  locale?: DriverLocale;
}) {
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [filter, setFilter] = useState("");
  const days = isoWeekDates(year, kw, locale || "de");
  const driverMode = Boolean(locale);
  const scheduleCopy = {
    de: { assignments: "Einsätze", conflicts: "Konflikte", search: "Fahrer, Kennzeichen, Firma, Block…", calendar: "Wochenkalender", table: "Tabelle", conflict: "Konflikt", noDriver: "KEIN FAHRER", noVehicle: "Ohne Fahrzeug", empty: "Keine Einsätze" },
    pl: { assignments: "Trasy", conflicts: "Konflikty", search: "Kierowca, pojazd, firma, blok…", calendar: "Kalendarz tygodnia", table: "Tabela", conflict: "Konflikt", noDriver: "BRAK KIEROWCY", noVehicle: "Bez pojazdu", empty: "Brak tras" },
    uk: { assignments: "Рейси", conflicts: "Конфлікти", search: "Водій, авто, компанія, блок…", calendar: "Календар тижня", table: "Таблиця", conflict: "Конфлікт", noDriver: "НЕМАЄ ВОДІЯ", noVehicle: "Без авто", empty: "Рейсів немає" },
    ru: { assignments: "Рейсы", conflicts: "Конфликты", search: "Водитель, машина, компания, блок…", calendar: "Календарь недели", table: "Таблица", conflict: "Конфликт", noDriver: "НЕТ ВОДИТЕЛЯ", noVehicle: "Без машины", empty: "Рейсов нет" },
  }[locale || "de"];
  const activeDrivers = staff.filter((person) => person.status === "active");
  const visibleRows = filter ? rows.filter((row) => [row.driver_name, row.license_plate, row.company, row.block_id, row.location].some((item) => String(item || "").toLowerCase().includes(filter.toLowerCase()))) : rows;
  const conflicts = new Set<string>();

  for (const day of days) {
    const daily = visibleRows.filter((row) => rowDays(row).has(day.number));
    for (const row of daily) {
      const sameDriver = row.driver_name
        ? daily.filter(
            (other) =>
              other.driver_name === row.driver_name &&
              String(other.start_time || "06:00") ===
                String(row.start_time || "06:00"),
          )
        : [];
      const sameVehicle = row.license_plate
        ? daily.filter(
            (other) =>
              other.license_plate === row.license_plate &&
              String(other.start_time || "06:00") ===
                String(row.start_time || "06:00"),
          )
        : [];
      if (sameDriver.length > 1 || sameVehicle.length > 1)
        conflicts.add(`${day.number}:${row.id}`);
    }
  }

  return (
    <div className="schedule-section">
      <div className="schedule-toolbar">
        <div className="schedule-stats">
          <span>
            <b>{rows.length}</b> {scheduleCopy.assignments}
          </span>
          {showAvailability ? (
            <span className={conflicts.size ? "stat-conflict" : "stat-ok"}>
              <b>{conflicts.size}</b> {scheduleCopy.conflicts}
            </span>
          ) : null}
        </div>
        {!driverMode ? <input className="schedule-filter" placeholder={scheduleCopy.search} value={filter} onChange={(event) => setFilter(event.target.value)} /> : null}
        {!driverMode ? <div className="view-switch" aria-label="Planungsansicht">
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            {scheduleCopy.calendar}
          </button>
          <button
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            {scheduleCopy.table}
          </button>
        </div> : null}
      </div>
      {view === "table" ? (
        <Planning rows={visibleRows} canEdit={canEdit} edit={edit} remove={remove} openDriver={openDriver} openVehicle={openVehicle} driverRatingMap={driverRatingMap} />
      ) : (
        <div className="week-calendar-wrap">
          <div className="week-calendar">
            {days.map((day) => {
              const dailyRows = visibleRows.filter((row) =>
                rowDays(row).has(day.number),
              );
              const assigned = new Set(
                dailyRows
                  .map((row) => String(row.driver_name || ""))
                  .filter(Boolean),
              );
              const free = activeDrivers.filter(
                (driver) => !assigned.has(String(driver.full_name)),
              );
              return (
                <section className="calendar-day" key={day.number} onDragOver={(event) => canEdit && event.preventDefault()} onDrop={(event) => { if (!canEdit) return; const id = Number(event.dataTransfer.getData("text/plain")); const row = rows.find((entry) => Number(entry.id) === id); if (row) move?.(row, day.number); }}>
                  <header>
                    <div>
                      <strong>{day.short}</strong>
                      <span>{day.name}</span>
                    </div>
                    <time>{day.date}</time>
                  </header>
                  <div className="day-assignments">
                    {dailyRows.length ? (
                      dailyRows.map((row) => {
                        const conflict = conflicts.has(
                          `${day.number}:${row.id}`,
                        );
                        const departureShift = departureShifts?.find((shift) => String(shift.planningId) === String(row.id) && shift.dayNumber === day.number);
                        const departureOverdue = departureShift?.status === "overdue";
                        return (
                          <article
                            className={`schedule-card ${conflict ? "has-conflict" : ""} ${departureOverdue ? "has-departure-overdue" : ""}`}
                            key={`${day.number}-${row.id}`}
                            draggable={canEdit}
                            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(row.id))}
                          >
                            <div className="schedule-card-head">
                              <b>{row.driver_name || scheduleCopy.noDriver}{row.driver_name && driverRatingMap ? <> <DriverPlanningRating metrics={lookupDriverRating(driverRatingMap, row.driver_name)} /></> : null}</b>
                              <span className="schedule-card-badges">{conflict ? <em>{scheduleCopy.conflict}</em> : null}{departureShift ? <DepartureConfirmBadge shift={departureShift} /> : null}</span>
                            </div>
                            <span>{row.company}</span>
                            <small>
                              {row.start_time || "06:00"} ·{" "}
                              {row.license_plate || scheduleCopy.noVehicle} ·{" "}
                              {row.location || "—"}
                            </small>
                            {canEdit ? (
                              <div className="schedule-card-actions">
                                <button onClick={() => edit?.(row)}>
                                  Bearbeiten
                                </button>
                                <button
                                  aria-label="Planung löschen"
                                  onClick={() =>
                                    confirm(
                                      "Planung für die ganze Woche löschen?",
                                    ) && remove?.(Number(row.id))
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <div className="day-empty">{scheduleCopy.empty}</div>
                    )}
                  </div>
                  {showAvailability ? (
                    <details className="free-drivers">
                      <summary>
                        <span className="availability-dot" /> {free.length}{" "}
                        Fahrer frei
                      </summary>
                      <div>
                        {free.length
                          ? free.map((driver) => (
                              <span key={driver.id}>{driver.full_name}{driverRatingMap ? <> <DriverPlanningRating metrics={lookupDriverRating(driverRatingMap, driver.full_name)} /></> : null}</span>
                            ))
                          : "Keine freien Fahrer"}
                      </div>
                    </details>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
function Concerns({
  rows,
  canEdit,
  edit,
  remove,
}: {
  rows: Row[];
  canEdit: boolean;
  edit: (r: Row) => void;
  remove: (id: number) => void;
}) {
  const [period, setPeriod] = useState("all");
  const periods = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r.period)))),
    [rows],
  );
  const visible =
    period === "all" ? rows : rows.filter((r) => r.period === period);
  return (
    <Card title="LKW Fahreranliegen">
      <div className="concern-toolbar">
        <span>Alle Anliegen zentral bearbeiten – ohne neue Monatsdatei.</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">Alle Monate</option>
          {periods.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Monat</th>
              <th>Firma / Base</th>
              <th>LKW</th>
              <th>Anliegen</th>
              <th>Bestand</th>
              <th>Erledigung</th>
              <th>Notiz</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.period}</td>
                <td>
                  <strong>{r.company}</strong>
                  <small>{r.base}</small>
                </td>
                <td>{r.truck_number}</td>
                <td>{r.item_name}</td>
                <td>{r.purchase_status || "—"}</td>
                <td>
                  <Badge value={String(r.completion_status)} />
                </td>
                <td>{r.notes || "—"}</td>
                {canEdit ? (
                  <td>
                    <div className="row-buttons">
                      <button className="edit-action" onClick={() => edit(r)}>
                        Bearbeiten
                      </button>
                      <button
                        className="delete-action"
                        onClick={() =>
                          confirm("Anliegen löschen?") && remove(Number(r.id))
                        }
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function DriverConcerns({
  rows,
  year,
  kw,
  locale,
  voiceMessages,
  planning,
  reload,
  submit,
}: {
  rows: Row[];
  year: number;
  kw: number;
  locale: DriverLocale;
  voiceMessages: Row[];
  planning: Row[];
  reload: () => Promise<void>;
  submit: (x: Record<string, unknown>) => void;
}) {
  const t = (key: string, fallback?: string) => driverText(locale, key, fallback);
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    submit({
      action: "driverConcern",
      planningYear: year,
      calendarWeek: kw,
      ...values,
    });
    form.reset();
  }
  return (
    <>
      <VoiceRecorder locale={locale} planning={planning} reload={reload} />
      <Card title={t("newConcern")} subtitle={t("concernHelp")}>
        <form className="driver-concern-form" onSubmit={send}>
          <div>
            <b>{t("whatNeeded")}</b>
            <span>{t("concernAuto")}</span>
          </div>
          <textarea
            name="itemName"
            required
            minLength={3}
            placeholder={t("concernPlaceholder")}
          />
          <input
            name="truckNumber"
            placeholder={t("plateOptional")}
          />
          <button className="primary-button">{t("sendDispatcher")}</button>
        </form>
      </Card>
      <Card title={t("sentConcerns")} subtitle={t("today")}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("truck")}</th>
                <th>{t("concern")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.created_at).slice(0, 10)}</td>
                    <td>{r.truck_number || "—"}</td>
                    <td>
                      <strong>{r.item_name}</strong>
                    </td>
                    <td>
                      <Badge value={String(r.completion_status)} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>{t("noConcerns")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={t("voiceHistory")} subtitle={t("today")}>
        <div className="voice-message-list">
          {voiceMessages.length ? voiceMessages.map((message) => <article key={message.id} className={`voice-message-card voice-${String(message.status).toLowerCase()}`}>
            <div><strong>{String(message.created_at).slice(0, 16).replace("T", " ")}</strong><span>{message.license_plate || t("truck")} · {Math.floor(Number(message.duration_seconds || 0) / 60)}:{String(Number(message.duration_seconds || 0) % 60).padStart(2, "0")}</span>{message.note ? <p>{message.note}</p> : null}</div>
            <audio controls preload="none" src={`/api/voice-messages/${message.id}`} aria-label={t("listen")} />
            <span className="status-pill">{message.status}</span>
          </article>) : <div className="empty-state">{t("noVoice")}</div>}
        </div>
      </Card>
    </>
  );
}

function VoiceRecorder({ locale, planning, reload }: { locale: DriverLocale; planning: Row[]; reload: () => Promise<void> }) {
  const t = (key: string, fallback?: string) => driverText(locale, key, fallback);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [note, setNote] = useState("");
  const [plate, setPlate] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const plates = useMemo(() => Array.from(new Set(planning.map((row) => String(row.license_plate || "")).filter(Boolean))), [planning]);

  function clearTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    clearTimer();
    setRecording(false);
  }
  async function startRecording() {
    setNotice("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const supported = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setRecordedBlob(blob);
        setSelectedFile(null);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start(500);
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((value) => {
        const next = value + 1;
        if (next >= 180) window.setTimeout(stopRecording, 0);
        return Math.min(180, next);
      }), 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setNotice(t("microphoneDenied"));
    }
  }
  useEffect(() => () => {
    clearTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  async function sendRecording() {
    const file = selectedFile || (recordedBlob ? new File([recordedBlob], `voice-${Date.now()}.${recordedBlob.type.includes("mp4") ? "m4a" : "webm"}`, { type: recordedBlob.type }) : null);
    if (!file) return setNotice(t("voiceMissing"));
    setSending(true);
    const form = new FormData();
    form.set("file", file);
    form.set("durationSeconds", String(seconds));
    form.set("note", note);
    form.set("licensePlate", plate);
    const response = await fetch("/api/voice-messages", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    setSending(false);
    if (!response.ok) return setNotice(result.error || t("voiceUploadError"));
    setNotice(t("voiceSent"));
    setRecordedBlob(null); setSelectedFile(null); setNote(""); setSeconds(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    await reload();
  }
  function selectAudio(file: File | undefined) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file); setRecordedBlob(null); setPreviewUrl(URL.createObjectURL(file)); setSeconds(0);
  }
  return <Card title={t("voiceTitle")} subtitle={t("voiceHelp")}>
    <div className="voice-recorder">
      <div className={`voice-record-control ${recording ? "is-recording" : ""}`}>
        <button type="button" className="voice-record-button" onClick={recording ? stopRecording : startRecording}><span>{recording ? "■" : "●"}</span>{recording ? t("stopRecording") : t("startRecording")}</button>
        <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</time>
      </div>
      {previewUrl ? <audio className="voice-preview" controls src={previewUrl} aria-label={t("playRecording")} /> : null}
      <div className="voice-recorder-fields">
        {plates.length ? <select value={plate} onChange={(event) => setPlate(event.target.value)}><option value="">{t("truck")}</option>{plates.map((item) => <option key={item}>{item}</option>)}</select> : null}
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={t("voiceNote")} />
        <label className="voice-file-label">{t("voiceFile")}<input type="file" accept="audio/*" capture onChange={(event) => selectAudio(event.target.files?.[0])} /></label>
      </div>
      <button type="button" className="primary-button voice-send-button" disabled={sending || (!recordedBlob && !selectedFile)} onClick={sendRecording}>{sending ? "…" : t("sendRecording")}</button>
      {notice ? <div className="inline-notice">{notice}</div> : null}
    </div>
  </Card>;
}

function VoiceMessagesCenter({ rows, action }: { rows: Row[]; action: (payload: Record<string, unknown>) => Promise<void> }) {
  return <Card title="Sprachnachrichten der Fahrer">
    <div className="voice-dispatch-list">
      {rows.length ? rows.map((message) => <article key={message.id} className={`voice-dispatch-card ${message.status === "Neu" ? "voice-new" : ""}`}>
        <div className="voice-dispatch-meta"><strong>{message.full_name}</strong><span>{message.license_plate || "Ohne Kennzeichen"} · {String(message.created_at).slice(0, 16).replace("T", " ")}</span>{message.note ? <p>{message.note}</p> : null}</div>
        <audio controls preload="none" src={`/api/voice-messages/${message.id}`} />
        <span className="status-pill">{message.status}</span>
        <div className="row-buttons"><button className="edit-action" onClick={() => action({ action: "updateVoiceMessageStatus", id: message.id, status: "Abgehört" })}>Abgehört</button><button className="row-action" onClick={() => action({ action: "updateVoiceMessageStatus", id: message.id, status: "Erledigt" })}>Erledigt</button></div>
      </article>) : <div className="empty-state">Keine Sprachnachrichten</div>}
    </div>
  </Card>;
}
function Documents({
  rows,
  staff,
  driver,
  locale,
  canUpload,
  reload,
}: {
  rows: Row[];
  staff: Row[];
  driver: boolean;
  locale: DriverLocale;
  canUpload: boolean;
  reload: () => Promise<void>;
}) {
  const c = {
    de: { title: "Meine Lohnabrechnungen", secure: "Geschützter Dokumentenbereich", info: "Nur Sie können Ihre persönlichen Lohnabrechnungen öffnen.", employee: "Mitarbeiter", period: "Zeitraum", file: "Datei", size: "Größe", date: "Datum", empty: "Noch keine Dokumente hochgeladen." },
    pl: { title: "Moje paski wynagrodzeń", secure: "Chroniony obszar dokumentów", info: "Tylko Ty możesz otwierać swoje dokumenty płacowe.", employee: "Pracownik", period: "Okres", file: "Plik", size: "Rozmiar", date: "Data", empty: "Brak dokumentów." },
    uk: { title: "Мої розрахункові листи", secure: "Захищені документи", info: "Лише ви можете відкривати власні документи про зарплату.", employee: "Працівник", period: "Період", file: "Файл", size: "Розмір", date: "Дата", empty: "Документів ще немає." },
    ru: { title: "Мои расчётные листы", secure: "Защищённые документы", info: "Только вы можете открывать свои документы о зарплате.", employee: "Сотрудник", period: "Период", file: "Файл", size: "Размер", date: "Дата", empty: "Документов пока нет." },
  }[locale];
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await fetch("/api/documents", {
      method: "POST",
      body: new FormData(form),
    });
    if (r.ok) {
      form.reset();
      await reload();
    } else alert((await r.json()).error);
  }
  return (
    <Card title={driver ? c.title : "Lohnabrechnungen"} subtitle={driver ? driverText(locale, "today") : undefined}>
      <div className="document-note">
        <b>{driver ? c.secure : "Sicherer Dokumentenbereich"}</b>
        <span>{driver ? c.info : "PDF-Lohnabrechnungen werden personenbezogen gespeichert. Fahrer sehen ausschließlich ihre eigenen Dokumente."}</span>
      </div>
      {canUpload ? (
        <form className="upload-form" onSubmit={upload}>
          <select name="staffId" required>
            <option value="">Mitarbeiter wählen</option>
            {staff.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.full_name}
              </option>
            ))}
          </select>
          <input name="period" type="month" required />
          <input name="file" type="file" accept="application/pdf" required />
          <button className="primary-button">PDF hochladen</button>
        </form>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{driver ? c.employee : "Mitarbeiter"}</th>
              <th>{driver ? c.period : "Zeitraum"}</th>
              <th>{driver ? c.file : "Datei"}</th>
              <th>{driver ? c.size : "Größe"}</th>
              <th>{driver ? c.date : "Datum"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.period}</td>
                  <td>
                    <a href={`/api/documents/${r.id}`}>
                      <strong>{r.file_name}</strong>
                    </a>
                  </td>
                  <td>{Math.round(Number(r.size_bytes) / 1024)} KB</td>
                  <td>{String(r.created_at).slice(0, 10)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>{driver ? c.empty : "Noch keine Dokumente hochgeladen."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const escape = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const text = "\uFEFF" + [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

function ReportCard({ icon, title, text, children }: { icon: string; title: string; text: string; children: React.ReactNode }) {
  return <article className="report-card2"><div className="report-icon">{icon}</div><div className="report-body"><h3>{title}</h3><p>{text}</p><div className="report-controls">{children}</div></div></article>;
}

type DatevField = { key: string; label: string; wageType: string; bs: number };
type DatevSettings = { consultant: string; client: string; wageTypes: Record<string, string> };

function DatevExport({ month, setMonth }: { month: string; setMonth: (value: string) => void }) {
  const [fields, setFields] = useState<DatevField[]>([]);
  const [settings, setSettings] = useState<DatevSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/payroll/datev", { cache: "no-store" }).then((response) => response.json()).then((result: { settings?: DatevSettings; fields?: DatevField[] }) => {
      if (result.settings) setSettings(result.settings);
      if (result.fields) setFields(result.fields);
    }).catch(() => setMessage("DATEV-Einstellungen konnten nicht geladen werden"));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/payroll/datev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultant: form.get("consultant"), client: form.get("client"), wageTypes: Object.fromEntries(fields.map((field) => [field.key, form.get(`wage-${field.key}`)])) }) });
    const result = await response.json().catch(() => ({})) as { settings?: DatevSettings; error?: string };
    if (!response.ok || !result.settings) return setMessage(result.error || "Speichern fehlgeschlagen");
    setSettings(result.settings); setOpen(false); setMessage("DATEV-Einstellungen gespeichert");
  }
  async function download() {
    setMessage("");
    const response = await fetch(`/api/payroll/datev?period=${month}`, { cache: "no-store" });
    if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; return setMessage(result.error || "Export fehlgeschlagen"); }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `LODAS-Bewegungsdaten-${month}.txt`; link.click(); URL.revokeObjectURL(url);
  }
  const ready = Boolean(settings?.consultant && settings?.client);
  return <ReportCard icon="D" title="DATEV-Export (LODAS)" text={ready ? `Berater ${settings?.consultant} · Mandant ${settings?.client}. Lohnwerte des Monats als LODAS-Importdatei für Ihr Steuerbüro.` : "Berater- und Mandantennummer sowie Lohnarten einmalig mit Ihrem Steuerbüro abstimmen und hinterlegen."}>
    <label>Monat<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
    <button type="button" className="primary-button" disabled={!ready} onClick={() => void download()}>Datei herunterladen</button>
    <button type="button" onClick={() => setOpen(!open)}>{open ? "Schließen" : "Einstellungen"}</button>
    {message ? <div className="inline-notice">{message}</div> : null}
    {open && settings ? <form className="datev-settings" onSubmit={save}>
      <label>Beraternummer<input name="consultant" inputMode="numeric" defaultValue={settings.consultant} maxLength={7} /></label>
      <label>Mandantennummer<input name="client" inputMode="numeric" defaultValue={settings.client} maxLength={5} /></label>
      {fields.map((field) => <label key={field.key}>{field.label}<input name={`wage-${field.key}`} inputMode="numeric" maxLength={4} defaultValue={settings.wageTypes[field.key] || ""} placeholder="Lohnart" /></label>)}
      <p>Leere Lohnart = Wert wird nicht exportiert. Die Personalnummer tragen Sie beim Mitarbeiter ein.</p>
      <button type="submit" className="primary-button">Speichern</button>
    </form> : null}
  </ReportCard>;
}

function ReportsCenter({ role, year, kw, staff, vehicles, payroll }: { role: string; year: number; kw: number; staff: Row[]; vehicles: Row[]; payroll: Row[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [planYear, setPlanYear] = useState(String(year));
  const [planKw, setPlanKw] = useState(String(kw));
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [audience, setAudience] = useState("finanzamt");
  const [month, setMonth] = useState(today.slice(0, 7));
  const canPlan = ["management", "dispatcher"].includes(role);
  const canFinance = ["management", "accountant"].includes(role);
  const monthPayroll = payroll.filter((row) => row.period === month);
  return <div className="reports-center">
    {canPlan ? <section><h2>Planung & Betrieb</h2>
      <ReportCard icon="▦" title="Wochenplan (PDF)" text="Alle Einsätze einer Kalenderwoche mit Fahrern, Fahrzeugen und offenen Punkten.">
        <label>Jahr<input type="number" value={planYear} onChange={(event) => setPlanYear(event.target.value)} /></label>
        <label>KW<input type="number" min="1" max="53" value={planKw} onChange={(event) => setPlanKw(event.target.value)} /></label>
        <a className="primary-button" href={`/api/reports/planning?year=${planYear}&kw=${planKw}`} target="_blank" rel="noreferrer">PDF öffnen</a>
      </ReportCard>
      {role === "management" ? <ReportCard icon="▥" title="Tagesbericht (PDF)" text="Was an einem Tag passiert ist: Touren, Probleme, Nachrichten.">
        <label>Datum<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <a className="primary-button" href={`/api/reports/daily?date=${day}`} target="_blank" rel="noreferrer">PDF öffnen</a>
      </ReportCard> : null}
      <ReportCard icon="◉" title="Mitarbeiterliste (CSV)" text="Alle Mitarbeiter mit Firma, Standort, System und Status – für Excel.">
        <button type="button" className="primary-button" onClick={() => downloadCsv(`mitarbeiter-${today}.csv`, ["Name", "System", "Firma", "Standort", "Status"], staff.map((row) => [row.full_name, row.system_type, row.company, row.location, row.status]))}>CSV herunterladen</button>
      </ReportCard>
      <ReportCard icon="▣" title="Fahrzeugliste (CSV)" text="Kennzeichen, Status, TÜV-Termin und Standort aller Fahrzeuge.">
        <button type="button" className="primary-button" onClick={() => downloadCsv(`fahrzeuge-${today}.csv`, ["Kennzeichen", "Firma", "Standort", "Status", "TÜV/HU"], vehicles.map((row) => [row.license_plate, row.company, row.location, row.status, row.inspection_due]))}>CSV herunterladen</button>
      </ReportCard>
    </section> : null}
    {canFinance ? <section><h2>Finanzen</h2>
      <ReportCard icon="€" title="Ausgabenbericht" text="Belege und Ausgaben für Finanzamt oder Auftraggeber in einem Zeitraum.">
        <label>Von<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Bis<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Für<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="finanzamt">Finanzamt</option><option value="kunde">Auftraggeber</option></select></label>
        <a className="primary-button" href={`/api/reports/expenses?from=${from}&to=${to}&audience=${audience}&format=pdf`} target="_blank" rel="noreferrer">PDF</a>
        <a href={`/api/reports/expenses?from=${from}&to=${to}&audience=${audience}&format=csv`}>CSV</a>
      </ReportCard>
      <DatevExport month={month} setMonth={setMonth} />
      <ReportCard icon="▤" title="Lohnübersicht (CSV)" text={monthPayroll.length ? `${monthPayroll.length} Abrechnungen im gewählten Monat. Einzelne PDF-Lohnzettel finden Sie unter „Lohn & Abrechnung“.` : "Für diesen Monat gibt es noch keine Abrechnungen. Zuerst unter „Lohn & Abrechnung“ berechnen."}>
        <label>Monat<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        <button type="button" className="primary-button" disabled={!monthPayroll.length} onClick={() => downloadCsv(`lohn-${month}.csv`, ["Mitarbeiter", "Monat", "Grundgehalt", "Arbeitstage", "Spesen", "Nacht", "Sonntag", "Feiertag", "Erstattungen", "Abzüge", "Auszahlung", "Status"], monthPayroll.map((row) => [row.full_name, row.period, row.base_salary, row.tour_count, row.expenses, row.night_bonus, row.sunday_bonus, row.holiday_bonus, row.reimbursements, row.deductions, row.net_amount, row.payment_status]))}>CSV herunterladen</button>
      </ReportCard>
    </section> : null}
  </div>;
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function EntryForm({
  kind,
  kw,
  staff,
  driverPerformance,
  editing,
  submit,
}: {
  kind: "staff" | "vehicle" | "planning" | "concern";
  kw: number;
  staff: Row[];
  driverPerformance?: Row[];
  editing: Row | null;
  submit: (x: Record<string, unknown>) => void;
}) {
  const driverRatingMap = useMemo(
    () => buildDriverRatingByName(staff, driverPerformance || []),
    [staff, driverPerformance],
  );
  function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const d = Object.fromEntries(formData);
    if (kind === "planning") d.workDays = formData.getAll("workDay").join(",");
    const action =
      kind === "staff"
        ? editing
          ? "updateStaff"
          : "addStaff"
        : kind === "vehicle"
          ? "addVehicle"
          : kind === "planning"
            ? editing
              ? "updatePlanning"
              : "addPlanning"
            : editing
              ? "updateConcern"
              : "addConcern";
    submit({ action, id: editing?.id, calendarWeek: kw, ...d });
  }
  const submitLabel = editing
    ? "Änderungen speichern"
    : kind === "staff"
      ? "Mitarbeiter anlegen"
      : kind === "vehicle"
        ? "Fahrzeug anlegen"
        : kind === "planning"
          ? `Planung für KW ${kw} speichern`
          : "Anliegen speichern";
  return (
    <form className="entry-form" onSubmit={go}>
      {kind === "staff" ? (
        <>
          <div className="form-intro wide"><span>01</span><div><b>Stammdaten des Mitarbeiters</b><small>Pflichtfelder sind mit einem Stern gekennzeichnet.</small></div></div>
          <label>
            Name*
            <input
              name="fullName"
              required
              autoComplete="name"
              defaultValue={String(editing?.full_name || "")}
              placeholder="Vor- und Nachname"
            />
          </label>
          <label>
            Personalnummer
            <input
              name="personnelNumber"
              inputMode="numeric"
              maxLength={10}
              defaultValue={String(editing?.personnel_number || "")}
              placeholder="für den DATEV-Export"
            />
          </label>
          <label>
            Systemart
            <select
              name="systemType"
              defaultValue={String(editing?.system_type || "2/1")}
            >
              <option>2/1</option>
              <option>2/2</option>
              <option>5/2</option>
              <option>SPRINGER</option>
            </select>
          </label>
          <div className="form-section wide">
            <b>Lohn</b>
            <span>Grundlage für den Monatsabschluss. Zuschläge und Spesen rechnet LOGIPAY automatisch dazu.</span>
          </div>
          <label>
            Lohnart
            <select name="payType" defaultValue={String(editing?.pay_type || payGuess(editing).type)}>
              <option value="monthly">Monatslohn</option>
              <option value="hourly">Stundenlohn</option>
              <option value="daily">Tagessatz</option>
            </select>
          </label>
          <label>
            Betrag €
            <input name="payAmount" inputMode="decimal" defaultValue={String(editing?.pay_amount || payGuess(editing).amount || "")} placeholder="z. B. 2600 oder 15,50" />
          </label>
          <label>
            Brutto / Netto
            <select name="payBasis" defaultValue={String(editing?.pay_basis || payGuess(editing).basis)}>
              <option value="brutto">Brutto (üblich)</option>
              <option value="netto">Netto vereinbart</option>
            </select>
          </label>
          <label>
            Einsatzart (für Spesen)
            <select name="tourType" defaultValue={String(editing?.tour_type || "fern")}>
              <option value="fern">Fernverkehr – mehrtägig, Übernachtung im Lkw</option>
              <option value="nah">Nahverkehr – abends zu Hause</option>
            </select>
          </label>
          <label>
            Standort
            <input
              name="location"
              defaultValue={String(editing?.location || "")}
              placeholder="z. B. Hamburg / Bremen"
            />
          </label>
          <label>
            Firma
            <input
              name="company"
              defaultValue={String(editing?.company || "")}
              placeholder="z. B. Muster GmbH"
            />
          </label>
          {!editing ? (
            <label>
              Eintrittsdatum
              <input type="date" name="hiredAt" />
            </label>
          ) : null}
          <div className="form-section wide">
            <b>Persönlicher Zugang</b>
            <span>
              {editing?.login_email
                ? `Login: ${editing.login_email}. Passwort leer lassen, wenn es nicht geändert werden soll.`
                : "E-Mail und Startpasswort anlegen, damit der Fahrer nur sein eigenes Fahrerportal sieht."}
            </span>
          </div>
          <label>
            Login E-Mail
            <input
              type="email"
              name="loginEmail"
              autoComplete="email"
              defaultValue={String(editing?.login_email || "")}
              placeholder="fahrer@firma.de"
            />
          </label>
          <label>
            {editing?.login_email ? "Neues Passwort" : "Startpasswort"}
            <input type="password" name="loginPassword" minLength={10} autoComplete="new-password" placeholder="Mindestens 10 Zeichen" />
          </label>
        </>
      ) : kind === "vehicle" ? (
        <>
          <div className="form-intro wide"><span>02</span><div><b>Fahrzeugdaten</b><small>Kennzeichen, Standort und Prüfdatum eindeutig hinterlegen.</small></div></div>
          <label>
            Kennzeichen*
            <input name="licensePlate" required placeholder="B-AB 1234" />
          </label>
          <label>
            Firma
            <input name="company" placeholder="z. B. Muster GmbH" />
          </label>
          <label>
            Standort
            <input name="location" placeholder="z. B. Hamburg" />
          </label>
          <label>
            Status
            <select name="status">
              <option value="active">Aktiv</option>
              <option value="workshop">Werkstatt</option>
              <option value="reserve">Reserve</option>
            </select>
          </label>
          <label>
            TÜV / HU / SP gültig bis
            <input type="date" name="inspectionDue" />
          </label>
          <label className="wide">
            Notiz
            <textarea name="notes" rows={3} placeholder="Ausstattung, Besonderheiten oder wichtige Hinweise" />
          </label>
        </>
      ) : kind === "planning" ? (
        <>
          <div className="form-intro wide"><span>03</span><div><b>Wochenplanung</b><small>Fahrer, Fahrzeug, Einsatztage und Block für KW {kw} festlegen.</small></div></div>
          <label>
            Firma*
            <input
              name="company"
              required
              defaultValue={String(editing?.company || "")}
              placeholder="Auftraggeber / Firma"
            />
          </label>
          <label>
            Fahrer
            <select
              name="driverName"
              defaultValue={String(editing?.driver_name || "")}
            >
              <option value="">NO DRIVER</option>
              {staff.map((s) => {
                const rating = lookupDriverRating(driverRatingMap, s.full_name);
                return (
                  <option key={s.id} value={String(s.full_name)}>
                    {s.full_name}{rating.ratingCount ? ` · ${rating.rating.toFixed(1)} ★` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Standort
            <input
              name="location"
              defaultValue={String(editing?.location || "")}
              placeholder="z. B. Hamburg"
            />
          </label>
          <label>
            Kennzeichen
            <input
              name="licensePlate"
              defaultValue={String(editing?.license_plate || "")}
              placeholder="B-AB 1234"
            />
          </label>
          <label>
            Beginn
            <input
              type="time"
              name="startTime"
              required
              defaultValue={String(editing?.start_time || "06:00")}
            />
          </label>
          <label>
            Status
            <select
              name="status"
              defaultValue={String(editing?.status || "planned")}
            >
              <option value="planned">Geplant</option>
              <option value="attention">Prüfen</option>
              <option value="vacation">Urlaub</option>
            </select>
          </label>
          <fieldset className="work-days wide">
            <legend>Einsatztage*</legend>
            <div>
              {weekDayNames.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="workDay"
                    value={index + 1}
                    defaultChecked={rowDays(editing || {}).has(index + 1)}
                  />
                  <span>{day.slice(0, 2)}</span>
                  <small>{day}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Block ID
            <input
              name="blockId"
              defaultValue={String(editing?.block_id || "")}
              placeholder="Auftrags-Nr."
            />
          </label>
          <label className="wide">
            Kommentar
            <textarea
              name="comments"
              rows={3}
              defaultValue={String(editing?.comments || "")}
              placeholder="Hinweise für Disposition und Fahrer"
            />
          </label>
        </>
      ) : (
        <>
          <div className="form-intro wide"><span>04</span><div><b>Fahreranliegen</b><small>Anliegen eindeutig einem Zeitraum, Fahrzeug und Status zuordnen.</small></div></div>
          <label>
            Monat*
            <input
              type="month"
              name="period"
              required
              defaultValue={String(editing?.period || "2026-02")}
            />
          </label>
          <label>
            Firma*
            <input
              name="company"
              required
              defaultValue={String(editing?.company || "")}
            />
          </label>
          <label>
            Base
            <input name="base" defaultValue={String(editing?.base || "")} placeholder="z. B. Hamburg" />
          </label>
          <label>
            LKW / Kennzeichen
            <input
              name="truckNumber"
              defaultValue={String(editing?.truck_number || "")}
              placeholder="B-AB 1234"
            />
          </label>
          <label className="wide">
            Anliegen*
            <input
              name="itemName"
              required
              defaultValue={String(editing?.item_name || "")}
              placeholder="Was benötigt der Fahrer?"
            />
          </label>
          <label>
            Bestand
            <select
              name="purchaseStatus"
              defaultValue={String(editing?.purchase_status || "")}
            >
              <option value="">—</option>
              <option>In stock</option>
              <option>Sold out</option>
              <option>Repurchase needed</option>
              <option>Temporarily unavailable</option>
            </select>
          </label>
          <label>
            Erledigung
            <select
              name="completionStatus"
              defaultValue={
                ["Neu", "In Bearbeitung", "Bestellt", "Erledigt"].includes(
                  String(editing?.completion_status || "Neu"),
                )
                  ? String(editing?.completion_status || "Neu")
                  : String(editing?.completion_status) === "Delivered"
                    ? "Erledigt"
                    : "Neu"
              }
            >
              <option>Neu</option>
              <option>In Bearbeitung</option>
              <option>Bestellt</option>
              <option>Erledigt</option>
            </select>
          </label>
          <label className="wide">
            Notiz / Fahrer
            <textarea name="notes" rows={3} defaultValue={String(editing?.notes || "")} placeholder="Weitere Informationen oder Rückmeldung an den Fahrer" />
          </label>
        </>
      )}
      <button className="primary-button wide" type="submit">
        {submitLabel} →
      </button>
    </form>
  );
}
