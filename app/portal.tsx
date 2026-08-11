"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortalUser } from "../lib/auth";
import { EmployeeDocuments, ExcelImporter, MaintenanceCenter, PasswordChange, PayrollCenter, SecurityCenter, TruckTracking } from "./advanced-panels";
import { AnalyticsCenter, ChecklistCenter, ExpenseCenter, NotificationsCenter, TachographCenter, TripExecutionCenter, UserManagement } from "./operations-panels";
import { driverLanguages, driverText, type DriverLocale } from "./driver-i18n";

type Section =
  | "overview"
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
  | "analytics"
  | "concerns"
  | "documents"
  | "personnel"
  | "import"
  | "security"
  | "reports";
type Row = Record<string, string | number | null>;
type Data = {
  staff: Row[];
  vehicles: Row[];
  planning: Row[];
  concerns: Row[];
  voiceMessages: Row[];
  documents: Row[];
  files: Row[];
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
  tripDocuments: Row[];
  tripMessages: Row[];
  expenses: Row[];
  notifications: Row[];
  checklists: Row[];
  payrollPeriods: Row[];
  year: number;
  kw: number;
};

const nav: { id: Section; label: string; roles: string[] }[] = [
  {
    id: "overview",
    label: "Übersicht",
    roles: ["management", "accountant", "dispatcher", "driver"],
  },
  {
    id: "staff",
    label: "Mitarbeiter",
    roles: ["management", "accountant", "dispatcher"],
  },
  {
    id: "vehicles",
    label: "Fahrzeugakte",
    roles: ["management", "dispatcher", "driver"],
  },
  {
    id: "tracking",
    label: "Live-Tracking",
    roles: ["management", "dispatcher", "driver"],
  },
  {
    id: "planning",
    label: "KW-Planung",
    roles: ["management", "dispatcher", "driver"],
  },
  { id: "operations", label: "Touren & Zustellung", roles: ["management", "dispatcher", "driver"] },
  { id: "messages", label: "Nachrichten", roles: ["management", "dispatcher", "driver"] },
  { id: "tachograph", label: "Tachograph", roles: ["management", "dispatcher", "driver"] },
  { id: "expenses", label: "Auslagen & Erstattungen", roles: ["management", "accountant", "driver"] },
  { id: "checklists", label: "Fahrzeug-Check", roles: ["management", "dispatcher", "driver"] },
  {
    id: "concerns",
    label: "Fahreranliegen",
    roles: ["management", "accountant", "dispatcher", "driver"],
  },
  {
    id: "documents",
    label: "Lohn & Abrechnung",
    roles: ["management", "accountant", "driver"],
  },
  { id: "personnel", label: "Personalakte", roles: ["management", "accountant", "driver"] },
  { id: "notifications", label: "Benachrichtigungen", roles: ["management", "accountant", "dispatcher", "driver"] },
  { id: "analytics", label: "Unternehmensanalyse", roles: ["management", "accountant", "dispatcher"] },
  { id: "users", label: "Benutzerverwaltung", roles: ["management"] },
  { id: "import", label: "Excel-Import", roles: ["management", "dispatcher"] },
  { id: "security", label: "Sicherheit & Audit", roles: ["management"] },
  {
    id: "reports",
    label: "Berichte",
    roles: ["management", "accountant", "dispatcher"],
  },
];

const labels: Record<string, string> = {
  management: "Management",
  accountant: "Buchhaltung",
  dispatcher: "Disposition",
  driver: "Fahrer",
};

const sectionDescriptions: Partial<Record<Section, string>> = {
  overview: "Heute im Blick: Fahrer, Fahrzeuge, Touren und offene Aufgaben",
  staff: "Personal, Zugänge und Beschäftigungsstatus zentral verwalten",
  vehicles: "Fahrzeugdaten, Dokumente, Prüfungen und Werkstattstatus",
  tracking: "Aktuelle Fahrzeugpositionen und operative Warnungen",
  planning: "Fahrer und Fahrzeuge konfliktfrei für die Woche einteilen",
  operations: "Tourstatus, Zustellung und Nachweise laufend aktualisieren",
  messages: "Alle geschützten Tour-Chats zwischen Fahrern und Disposition",
  tachograph: "Fahrzeiten, Ruhezeiten und Verstöße kontrollieren",
  expenses: "Belege prüfen, Erstattungen freigeben und Kosten auswerten",
  checklists: "Fahrzeugkontrollen vor und nach jeder Tour dokumentieren",
  concerns: "Anliegen der Fahrer annehmen, bearbeiten und abschließen",
  documents: "Monatsabrechnungen berechnen, prüfen und sicher abschließen",
  personnel: "Verträge, Führerscheine und persönliche Dokumente schützen",
  notifications: "Wichtige Meldungen aus allen Arbeitsbereichen bündeln",
  analytics: "Auslastung, Qualität und Kosten der Logistik überblicken",
};

export function Portal({ currentUser }: { currentUser: PortalUser }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<Data>({
    staff: [],
    vehicles: [],
    planning: [],
    concerns: [],
    voiceMessages: [],
    documents: [],
    files: [],
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
    tripDocuments: [],
    tripMessages: [],
    expenses: [],
    notifications: [],
    checklists: [],
    payrollPeriods: [],
    year: 2026,
    kw: 32,
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [kw, setKw] = useState(32);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    "staff" | "vehicle" | "planning" | "concern" | null
  >(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [locale, setLocale] = useState<DriverLocale>("de");
  const [pushState, setPushState] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  // Keep the first server and browser render identical; the real connection
  // state is applied after hydration in the effect below.
  const [online, setOnline] = useState(true);
  const [renderedAt] = useState(() => new Date().getTime());
  const isDriver = currentUser.role === "driver";
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
        setData(JSON.parse(body));
      } catch {
        setNotice(isDriver ? t("loadError") : "Daten konnten nicht geladen werden. Bitte Seite neu laden.");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [year, kw, isDriver, t],
  );
  useEffect(() => {
    const initial = window.setTimeout(() => load(), 0);
    const refresh = window.setInterval(() => load(true), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, [load]);
  useEffect(() => {
    if (!isDriver) return;
    const savedLocale = localStorage.getItem("logipay_driver_locale") as DriverLocale | null;
    const requestedSection = new URLSearchParams(window.location.search).get("section") as Section | null;
    const supported = "serviceWorker" in navigator && "Notification" in window;
    const syncPreferences = window.setTimeout(() => {
      if (savedLocale && driverLanguages.some((item) => item.code === savedLocale)) setLocale(savedLocale);
      if (requestedSection && nav.some((item) => item.id === requestedSection && item.roles.includes("driver"))) setSection(requestedSection);
      setPushState(supported ? Notification.permission : "unsupported");
    }, 0);
    if (supported) void navigator.serviceWorker.register("/sw.js");
    return () => window.clearTimeout(syncPreferences);
  }, [isDriver]);
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
      if (!remaining.length) { setNotice(isDriver ? t("synced") : "Offline-Eingaben wurden synchronisiert"); await load(true); }
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
  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushState(permission);
      if (permission === "granted") {
        await navigator.serviceWorker.register("/sw.js");
        setNotice(t("pushReady"));
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
      const offlineSafe = new Set(["saveTripOperation", "saveChecklist", "driverConcern"]);
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
    setModal(null);
    setEditing(null);
    setNotice(isDriver ? t("saved") : "Änderung gespeichert");
    await load();
  }
  function openModal(
    kind: "staff" | "vehicle" | "planning" | "concern",
    row?: Row,
  ) {
    setEditing(row || null);
    setModal(kind);
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
  const openConcernCount = data.concerns.filter(
    (item) =>
      !["Erledigt", "Delivered"].includes(String(item.completion_status)),
  ).length + data.voiceMessages.filter((item) => String(item.status) === "Neu").length;
  const trackingAlertCount = data.tracking.filter((item) => {
    if (!item.recorded_at) return true;
    const age = renderedAt - new Date(String(item.recorded_at)).getTime();
    return age > 30 * 60_000 || Number(item.speed_kph || 0) > 90;
  }).length;
  const unreadNotificationCount = data.notifications.filter((item) => !item.read_at).length;
  const unreadChatCount = data.tripMessages.filter((item) => !Number(item.read_by_me) && Number(item.sender_user_id) !== currentUser.id).length;
  const title = isDriver ? t(section, nav.find((n) => n.id === section)?.label) : nav.find((n) => n.id === section)?.label;
  return (
    <main className={`app-shell role-${currentUser.role} ${isDriver ? "driver-mobile-shell" : ""}`}>
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
            <small>{isDriver ? t("driver") : "Personal & Disposition"}</small>
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
          <p>{isDriver ? t("workArea") : "ARBEITSBEREICH"}</p>
          {nav
            .filter((n) => n.roles.includes(currentUser.role))
            .map((n) => (
              <button
                key={n.id}
                className={section === n.id ? "nav-active" : ""}
                onClick={() => { setSection(n.id); setMobileMenu(false); }}
              >
                <span className="nav-icon">
                  {
                    (
                      {
                        overview: "⌂",
                        staff: "◉",
                        vehicles: "▣",
                        tracking: "⌖",
                        planning: "▦",
                        operations: "➜",
                        messages: "✉",
                        tachograph: "◴",
                        expenses: "◈",
                        checklists: "✓",
                        concerns: "!",
                        documents: "€",
                        personnel: "▤",
                        notifications: "●",
                        analytics: "▥",
                        users: "◎",
                        import: "⇧",
                        security: "⌾",
                        reports: "▥",
                      } as Record<string, string>
                    )[n.id]
                  }
                </span>
                {isDriver ? t(n.id, n.label) : n.label}
                {n.id === "concerns" &&
                ["management", "dispatcher"].includes(currentUser.role) &&
                openConcernCount ? (
                  <span className="nav-counter">{openConcernCount}</span>
                ) : null}
                {n.id === "tracking" && trackingAlertCount ? (
                  <span className="nav-counter">{trackingAlertCount}</span>
                ) : null}
                {n.id === "notifications" && unreadNotificationCount ? (
                  <span className="nav-counter">{unreadNotificationCount}</span>
                ) : null}
                {n.id === "messages" && unreadChatCount ? (
                  <span className="nav-counter nav-counter-chat">{unreadChatCount}</span>
                ) : null}
              </button>
            ))}
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
          <button className="logout-button" onClick={logout}>
            ↪ {isDriver ? t("logout") : "Abmelden"}
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button className="menu-toggle" aria-label={isDriver ? t("menuOpen") : "Menü öffnen"} onClick={() => setMobileMenu(true)}>☰</button>
          <div className="period-control">
            <span>{isDriver ? t("planningPeriod") : "Planungszeitraum"}</span>
            <select value={year} onChange={(e) => setYear(+e.target.value)}>
              {Array.from(
                { length: 5 },
                (_, i) => new Date().getFullYear() - 1 + i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select value={kw} onChange={(e) => setKw(+e.target.value)}>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>
                  KW {k}
                </option>
              ))}
            </select>
            <button
              className="next-week"
              onClick={() => {
                if (kw < 53) setKw(kw + 1);
                else {
                  setKw(1);
                  setYear(year + 1);
                }
              }}
            >
              {isDriver ? t("nextWeek") : "Nächste Woche"} →
            </button>
          </div>
          {isDriver ? <div className="driver-language-switch" role="group" aria-label={t("language")}>
            {driverLanguages.map((item) => <button key={item.code} type="button" className={locale === item.code ? "language-active" : ""} title={item.label} aria-label={item.label} onClick={() => changeLocale(item.code)}>{item.short}</button>)}
          </div> : null}
          <div className="top-actions">
            {["management", "dispatcher", "driver"].includes(currentUser.role) ? (
              <button className="top-chat-button" type="button" onClick={() => setSection("messages")} aria-label={isDriver ? t("messages") : "Nachrichten"}>
                <span>✉</span>
                <b>{isDriver ? t("messages") : "Nachrichten"}</b>
                {unreadChatCount ? <i>{Math.min(99, unreadChatCount)}</i> : null}
              </button>
            ) : null}
            {["management", "dispatcher"].includes(currentUser.role) ? (
              <button className="pdf-button" onClick={downloadPlanningReport}>
                ↓ Planning Report PDF
              </button>
            ) : null}
            {isDriver ? <button className={`push-button push-${pushState}`} type="button" onClick={enablePush} disabled={pushState === "granted" || pushState === "unsupported"}>
              {pushState === "granted" ? t("notificationsOn") : pushState === "denied" ? t("notificationsDenied") : pushState === "unsupported" ? t("notificationsUnsupported") : t("notificationsEnable")}
            </button> : null}
            <div className={`status-chip ${online ? "" : "status-offline"}`}>
              <span /> {online ? (isDriver ? t("connected") : "Datenbank verbunden") : (isDriver ? t("offline") : "Offline-Modus")}
            </div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p>{isDriver ? t("logistics") : "LOGISTIKVERWALTUNG"}</p>
              <h1>{title}</h1>
              <span>{isDriver ? t("centralData") : sectionDescriptions[section] || "Zentrale Daten statt einzelner Excel-Tabellen"}</span>
            </div>
            {section === "staff" && currentUser.role === "management" ? (
              <button
                className="primary-button"
                onClick={() => openModal("staff")}
              >
                ＋ Mitarbeiter einstellen
              </button>
            ) : section === "vehicles" &&
              ["management", "dispatcher"].includes(currentUser.role) ? (
              <button
                className="primary-button"
                onClick={() => openModal("vehicle")}
              >
                ＋ Fahrzeug anlegen
              </button>
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
            <div className="empty-state">{isDriver ? t("loading") : "Daten werden geladen…"}</div>
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
                    enablePush={enablePush}
                    unreadCount={unreadNotificationCount}
                    openSection={setSection}
                  />
                ) : (
                  <>
                    <div className="overview-command-card">
                      <div>
                        <small>OPERATIVE ZENTRALE</small>
                        <h2>Guten Tag, {currentUser.fullName.split(" ")[0]}</h2>
                        <p>{unreadChatCount ? `${unreadChatCount} neue Chat-Nachrichten benötigen Aufmerksamkeit.` : "Alle Tour-Chats sind gelesen."}</p>
                      </div>
                      <div className="overview-quick-actions">
                        <button type="button" onClick={() => setSection("messages")}><span>✉</span><b>Nachrichten</b><small>{unreadChatCount ? `${unreadChatCount} neu` : "Alles gelesen"}</small></button>
                        <button type="button" onClick={() => setSection("planning")}><span>▦</span><b>Wochenplanung</b><small>KW {kw}</small></button>
                        <button type="button" onClick={() => setSection("concerns")}><span>!</span><b>Fahreranliegen</b><small>{openConcernCount} offen</small></button>
                      </div>
                    </div>
                    <div className="metric-grid">
                      <Metric
                        label="Aktive Mitarbeiter"
                        value={String(active.length)}
                        note={`${data.staff.length - active.length} ausgeschieden`}
                      />
                      <Metric
                        label="Fahrzeuge"
                        value={String(data.vehicles.length)}
                        note={`${workshop.length} in Werkstatt`}
                      />
                      <Metric
                        label={`Planung KW ${kw}`}
                        value={String(data.planning.length)}
                        note="Zuordnungen"
                      />
                      <Metric
                        label="Abrechnungen"
                        value={String(data.documents.length)}
                        note="sicher gespeichert"
                      />
                    </div>
                    <div className="dashboard-grid">
                      <Card title="Aktuelle Planung">
                        <Planning rows={data.planning.slice(0, 6)} />
                      </Card>
                      <Card title="Hinweise">
                        <div className="attention-list">
                          <p>
                            <b>{workshop.length}</b>
                            <span>Fahrzeuge in der Werkstatt</span>
                          </p>
                          <p>
                            <b>{expiringDocuments.length}</b>
                            <span>Dokumente laufen bald ab</span>
                          </p>
                          <p>
                            <b>
                              {
                                data.planning.filter(
                                  (x) => x.status === "attention",
                                ).length
                              }
                            </b>
                            <span>Planungen mit Hinweis</span>
                          </p>
                        </div>
                      </Card>
                    </div>
                  </>
                ))}
              {section === "staff" && (
                <Card title="Mitarbeiterstamm">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Systemart</th>
                          <th>Vergütung</th>
                          <th>Standort</th>
                          <th>Firma</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.staff.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <button
                                className="staff-link"
                                onClick={() => setSelectedStaff(s)}
                              >
                                <strong>{s.full_name}</strong>
                                <small>Dossier öffnen</small>
                              </button>
                            </td>
                            <td>{s.system_type || "—"}</td>
                            <td>{s.compensation || "—"}</td>
                            <td>{s.location || "—"}</td>
                            <td>{s.company || "—"}</td>
                            <td>
                              <Badge value={String(s.status)} />
                            </td>
                            <td>
                              {currentUser.role === "management" ? (
                                <div className="row-buttons">
                                  <button
                                    className="edit-action"
                                    onClick={() => openModal("staff", s)}
                                  >
                                    Bearbeiten
                                  </button>
                                  <button
                                    className="row-action"
                                    onClick={() =>
                                      action({
                                        action:
                                          s.status === "active"
                                            ? "archiveStaff"
                                            : "restoreStaff",
                                        id: s.id,
                                      })
                                    }
                                  >
                                    {s.status === "active"
                                      ? "Ausscheiden"
                                      : "Reaktivieren"}
                                  </button>
                                  {s.status === "archived" ? (
                                    <button
                                      className="delete-action"
                                      onClick={() =>
                                        confirm("Endgültig löschen?") &&
                                        action({
                                          action: "deleteStaff",
                                          id: s.id,
                                        })
                                      }
                                    >
                                      Löschen
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
              {section === "vehicles" && (
                <div className="advanced-stack">
                  <VehicleFiles vehicles={data.vehicles} files={data.files} planning={data.planning} driver={currentUser.role === "driver"} locale={locale} reload={load} />
                  <MaintenanceCenter rows={data.maintenance} vehicles={data.vehicles} canEdit={["management", "dispatcher"].includes(currentUser.role)} action={action} />
                </div>
              )}
              {section === "tracking" && (
                <TruckTracking
                  rows={data.tracking}
                  vehicles={data.vehicles}
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
                  {currentUser.role !== "driver" ? <PlanningAlerts rows={data.planning} staff={data.staff} vehicles={data.vehicles} /> : null}
                  <WeeklySchedule
                    rows={data.planning}
                    staff={active}
                    year={year}
                    kw={kw}
                    locale={isDriver ? locale : undefined}
                    showAvailability={currentUser.role !== "driver"}
                    canEdit={currentUser.role !== "driver"}
                    edit={(row) => openModal("planning", row)}
                    remove={(id) => action({ action: "deletePlanning", id })}
                    move={(row, day) => action({ action: "updatePlanning", id: row.id, planningYear: year, calendarWeek: kw, company: row.company, driverName: row.driver_name, location: row.location, licensePlate: row.license_plate, workDays: String(day), startTime: row.start_time || "06:00", blockId: row.block_id, status: row.status, comments: row.comments })}
                  />
                </Card>
              )}
              {section === "operations" && <TripExecutionCenter rows={data.tripOperations} documents={data.tripDocuments} messages={data.tripMessages} driver={currentUser.role === "driver"} currentUserId={currentUser.id} locale={locale} action={action} reload={load} />}
              {section === "messages" && <TripExecutionCenter rows={data.tripOperations} documents={data.tripDocuments} messages={data.tripMessages} driver={currentUser.role === "driver"} currentUserId={currentUser.id} locale={locale} action={action} reload={load} view="chat" />}
              {section === "tachograph" && <TachographCenter rows={data.tachograph} staff={active} vehicles={data.vehicles} canEdit={["management", "dispatcher"].includes(currentUser.role)} locale={locale} action={action} />}
              {section === "expenses" && <ExpenseCenter rows={data.expenses} staff={active} vehicles={data.vehicles} driver={currentUser.role === "driver"} canApprove={["management", "accountant"].includes(currentUser.role)} locale={locale} action={action} reload={load} />}
              {section === "checklists" && <ChecklistCenter rows={data.checklists} staff={active} vehicles={data.vehicles} planning={data.planning} driver={currentUser.role === "driver"} locale={locale} action={action} />}
              {section === "concerns" &&
                (currentUser.role === "driver" ? (
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
                  <PayrollCenter rows={data.payroll} periods={data.payrollPeriods} staff={active} driver={currentUser.role === "driver"} management={currentUser.role === "management"} locale={locale} action={action} />
                  <Documents rows={data.documents} staff={active} driver={currentUser.role === "driver"} locale={locale} canUpload={["management", "accountant"].includes(currentUser.role)} reload={load} />
                </div>
              )}
              {section === "personnel" && <EmployeeDocuments rows={data.employeeDocuments} staff={data.staff} driver={currentUser.role === "driver"} locale={locale} reload={load} />}
              {section === "notifications" && <NotificationsCenter rows={data.notifications} driver={currentUser.role === "driver"} locale={locale} action={action} />}
              {section === "analytics" && <AnalyticsCenter staff={data.staff} vehicles={data.vehicles} operations={data.tripOperations} expenses={data.expenses} tachograph={data.tachograph} concerns={data.concerns} checklists={data.checklists} />}
              {section === "users" && <UserManagement rows={data.portalUsers} staff={data.staff} resetRequests={data.resetRequests} action={action} />}
              {section === "import" && <ExcelImporter staff={data.staff} vehicles={data.vehicles} planning={data.planning} year={year} kw={kw} reload={load} />}
              {section === "security" && <SecurityCenter loginAudit={data.loginAudit} resetRequests={data.resetRequests} audit={data.audit} action={action} />}
              {section === "reports" && (
                <div className="report-grid">
                  <Report
                    title={`Planning Report KW ${kw}`}
                    text="Block-Rejections, offene Fälle und Hinweise aus der Wochenplanung."
                    action={
                      ["management", "dispatcher"].includes(currentUser.role)
                        ? downloadPlanningReport
                        : undefined
                    }
                    actionLabel={
                      ["management", "dispatcher"].includes(currentUser.role)
                        ? "Planning Report PDF →"
                        : "Nur für Disposition"
                    }
                  />
                  <Report
                    title="Mitarbeiterliste"
                    text="Aktive und ausgeschiedene Mitarbeiter mit Firma, Standort und Systemart."
                  />
                  <Report
                    title="Kennzeichenliste"
                    text="Fahrzeuge, Werkstattstatus, TÜV/SP und Zuordnung."
                  />
                  <Report
                    title="Lohnabrechnungsübersicht"
                    text="Dokumentenstatus je Mitarbeiter und Abrechnungsmonat."
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {isDriver ? <nav className="driver-bottom-nav" aria-label={t("workArea")}>
        {([
          ["overview", "⌂", "home"],
          ["operations", "➜", "operations"],
          ["messages", "✉", "messages"],
          ["expenses", "◈", "receipts"],
          ["notifications", "!", "alerts"],
        ] as Array<[Section, string, string]>).map(([id, icon, key]) => <button key={id} type="button" className={section === id ? "bottom-nav-active" : ""} onClick={() => setSection(id)}><span>{icon}</span><b>{t(key)}</b>{id === "notifications" && unreadNotificationCount ? <i>{Math.min(99, unreadNotificationCount)}</i> : null}{id === "messages" && unreadChatCount ? <i>{Math.min(99, unreadChatCount)}</i> : null}</button>)}
      </nav> : null}
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

function VehicleFiles({
  vehicles,
  files,
  planning,
  driver,
  locale,
  reload,
}: {
  vehicles: Row[];
  files: Row[];
  planning: Row[];
  driver: boolean;
  locale: DriverLocale;
  reload: () => Promise<void>;
}) {
  const c = {
    de: { title: "Mein Fahrzeug · Fotos und Dokumente", plate: "Kennzeichen wählen", before: "Vor Fahrt", after: "Nach Fahrt", damage: "Schaden", docs: "Fahrzeugdokument", note: "Notiz", upload: "Hochladen", date: "Datum", category: "Kategorie", file: "Datei", empty: "Noch keine Fotos oder Dokumente." },
    pl: { title: "Mój pojazd · zdjęcia i dokumenty", plate: "Wybierz pojazd", before: "Przed trasą", after: "Po trasie", damage: "Uszkodzenie", docs: "Dokument pojazdu", note: "Notatka", upload: "Wyślij", date: "Data", category: "Kategoria", file: "Plik", empty: "Brak zdjęć i dokumentów." },
    uk: { title: "Моя вантажівка · фото та документи", plate: "Виберіть авто", before: "Перед рейсом", after: "Після рейсу", damage: "Пошкодження", docs: "Документ авто", note: "Примітка", upload: "Завантажити", date: "Дата", category: "Категорія", file: "Файл", empty: "Фото та документів ще немає." },
    ru: { title: "Мой грузовик · фото и документы", plate: "Выберите машину", before: "До рейса", after: "После рейса", damage: "Повреждение", docs: "Документ машины", note: "Заметка", upload: "Загрузить", date: "Дата", category: "Категория", file: "Файл", empty: "Фото и документов пока нет." },
  }[locale];
  const plates = Array.from(
    new Set([
      ...vehicles.map((v) => String(v.license_plate)),
      ...planning.map((p) => String(p.license_plate || "")).filter(Boolean),
    ]),
  );
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await fetch("/api/vehicle-files", {
      method: "POST",
      body: new FormData(e.currentTarget),
    });
    if (r.ok) {
      e.currentTarget.reset();
      await reload();
    } else alert((await r.json()).error);
  }
  return (
    <>
      <Card
        title={
          driver
            ? c.title
            : "Digitale Fahrzeugakte"
        }
      >
        {driver ? (
          <form className="upload-form" onSubmit={upload}>
            <select name="licensePlate" required>
              <option value="">{c.plate}</option>
              {plates.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select name="category" required>
              <option value="before">{c.before}</option>
              <option value="after">{c.after}</option>
              <option value="damage">{c.damage}</option>
              <option value="tuev">TÜV / HU / SP</option>
              <option value="document">{c.docs}</option>
            </select>
            <input name="notes" placeholder={c.note} />
            <input
              name="file"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              required
            />
            <button className="primary-button">{c.upload}</button>
          </form>
        ) : (
          <div className="viewer-note">
            Die Fahrzeugfotos werden von den Fahrern hochgeladen. Management und
            Disposition haben hier Lesezugriff.
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{driver ? c.date : "Datum"}</th>
                <th>{driver ? c.plate : "Kennzeichen"}</th>
                <th>{driver ? c.category : "Kategorie"}</th>
                {!driver ? <th>Fahrer</th> : null}
                <th>{driver ? c.file : "Datei"}</th>
                <th>{driver ? c.note : "Notiz"}</th>
              </tr>
            </thead>
            <tbody>
              {files.length ? (
                files.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {String(f.created_at).slice(0, 16).replace("T", " ")}
                    </td>
                    <td>
                      <strong>{f.license_plate}</strong>
                    </td>
                    <td>
                      <Badge value={String(f.category)} />
                    </td>
                    {!driver ? <td>{f.driver_name || "—"}</td> : null}
                    <td>
                      <a href={`/api/vehicle-files/${f.id}`} target="_blank">
                        {f.file_name}
                      </a>
                    </td>
                    <td>{f.notes || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={driver ? 5 : 6}>
                    {driver ? c.empty : "Noch keine Fotos oder Dokumente."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function DriverDossier({
  staff,
  planning,
  vehicles,
  files,
  employeeDocuments,
  payroll,
  close,
}: {
  staff: Row;
  planning: Row[];
  vehicles: Row[];
  files: Row[];
  employeeDocuments: Row[];
  payroll: Row[];
  close: () => void;
}) {
  const trips = planning.filter(
    (p) => p.staff_id === staff.id || p.driver_name === staff.full_name,
  );
  const plates = Array.from(
    new Set(trips.map((t) => String(t.license_plate || "")).filter(Boolean)),
  );
  const trucks = vehicles.filter((v) =>
    plates.includes(String(v.license_plate)),
  );
  const docs = files.filter((f) => f.staff_id === staff.id);
  const personnel = employeeDocuments.filter((f) => f.staff_id === staff.id);
  const salary = payroll.filter((record) => record.staff_id === staff.id);
  return (
    <div className="modal-backdrop">
      <div className="dossier">
        <div className="modal-head">
          <div>
            <h2>{staff.full_name}</h2>
            <small>Fahrer- und Fahrzeugdossier</small>
          </div>
          <button onClick={close}>×</button>
        </div>
        <div className="dossier-actions"><a className="primary-button" href={`/api/staff/${staff.id}/export`} target="_blank">DSGVO-Datenexport</a></div>
        <div className="dossier-grid">
          <section>
            <h3>Fahrerdaten</h3>
            <p>
              <span>Status</span>
              <Badge value={String(staff.status)} />
            </p>
            <p>
              <span>Firma</span>
              <b>{staff.company || "—"}</b>
            </p>
            <p>
              <span>Standort</span>
              <b>{staff.location || "—"}</b>
            </p>
            <p>
              <span>Systemart</span>
              <b>{staff.system_type || "—"}</b>
            </p>
            <p>
              <span>Vergütung</span>
              <b>{staff.compensation || "—"}</b>
            </p>
            <p>
              <span>Login</span>
              <b>{staff.login_email || "Kein Zugang"}</b>
            </p>
          </section>
          <section>
            <h3>Zugeordnete Fahrzeuge</h3>
            {trucks.length ? (
              trucks.map((v) => (
                <p key={v.id}>
                  <span>{v.license_plate}</span>
                  <b>
                    {v.status} · {v.location}
                  </b>
                </p>
              ))
            ) : (
              <p>Kein Fahrzeug in dieser KW.</p>
            )}
          </section>
        </div>
        <h3 className="dossier-title">Planung und Touren</h3>
        <Planning rows={trips} />
        {personnel.length ? <><h3 className="dossier-title">Personalakte</h3><div className="file-grid">{personnel.map((file) => <a key={file.id} href={`/api/employee-documents/${file.id}`} target="_blank"><b>{file.category}</b><span>Gültig bis {file.expires_at || "unbefristet"}</span><small>{file.file_name}</small></a>)}</div></> : null}
        {salary.length ? <><h3 className="dossier-title">Lohnjournal</h3><div className="file-grid">{salary.map((record) => <div key={record.id} className="dossier-pay"><b>{record.period}</b><span>Netto {Number(record.net_amount || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span><small>{record.payment_status}</small></div>)}</div></> : null}
        <h3 className="dossier-title">
          Vom Fahrer hochgeladene Fotos und Dokumente
        </h3>
        <div className="file-grid">
          {docs.length ? (
            docs.map((f) => (
              <a key={f.id} href={`/api/vehicle-files/${f.id}`} target="_blank">
                <b>{f.category}</b>
                <span>
                  {f.license_plate} · {String(f.created_at).slice(0, 10)}
                </span>
                <small>{f.file_name}</small>
              </a>
            ))
          ) : (
            <div className="empty-state">
              Dieser Fahrer hat noch keine Fahrzeugfotos hochgeladen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon mint">✓</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
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
}: {
  rows: Row[];
  canEdit?: boolean;
  edit?: (row: Row) => void;
  remove?: (id: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Firma</th>
            <th>Fahrer</th>
            <th>Standort</th>
            <th>Kennzeichen</th>
            <th>Tage</th>
            <th>Beginn</th>
            <th>Block ID</th>
            <th>Status</th>
            <th>Kommentar</th>
            {canEdit ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.company}</strong>
                </td>
                <td>{r.start_time || "06:00"}</td>
                <td>{r.driver_name || "NO DRIVER"}</td>
                <td>{r.location || "—"}</td>
                <td>{r.license_plate || "—"}</td>
                <td>
                  {Array.from(rowDays(r))
                    .map((day) => weekDayNames[day - 1].slice(0, 2))
                    .join(", ")}
                </td>
                <td>{r.block_id || "—"}</td>
                <td>
                  <Badge value={String(r.status)} />
                </td>
                <td>{r.comments || "—"}</td>
                {canEdit ? (
                  <td>
                    <div className="row-buttons">
                      <button className="edit-action" onClick={() => edit?.(r)}>
                        Bearbeiten
                      </button>
                      <button
                        className="delete-action"
                        onClick={() =>
                          confirm("Planung löschen?") && remove?.(Number(r.id))
                        }
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={canEdit ? 10 : 9}>
                Keine Einträge für diese Woche.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
}: {
  rows: Row[];
  staff: Row[];
  vehicles: Row[];
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
            Fahrer, Fahrzeuge, Kennzeichen und Prüftermine werden automatisch
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
        <Planning rows={visibleRows} canEdit={canEdit} edit={edit} remove={remove} />
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
                        return (
                          <article
                            className={`schedule-card ${conflict ? "has-conflict" : ""}`}
                            key={`${day.number}-${row.id}`}
                            draggable={canEdit}
                            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(row.id))}
                          >
                            <div className="schedule-card-head">
                              <b>{row.driver_name || scheduleCopy.noDriver}</b>
                              {conflict ? <em>{scheduleCopy.conflict}</em> : null}
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
                              <span key={driver.id}>{driver.full_name}</span>
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
    const r = await fetch("/api/documents", {
      method: "POST",
      body: new FormData(e.currentTarget),
    });
    if (r.ok) {
      e.currentTarget.reset();
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
function Report({
  title,
  text,
  action,
  actionLabel = "Bericht vorbereiten →",
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <article className="report-card">
      <div>▥</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <button
        onClick={
          action ||
          (() => alert("Bericht wird aus den aktuellen Daten erzeugt."))
        }
      >
        {actionLabel}
      </button>
    </article>
  );
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
  editing,
  submit,
}: {
  kind: "staff" | "vehicle" | "planning" | "concern";
  kw: number;
  staff: Row[];
  editing: Row | null;
  submit: (x: Record<string, unknown>) => void;
}) {
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
            Systemart
            <select
              name="systemType"
              defaultValue={String(editing?.system_type || "2/1")}
            >
              <option>2/1</option>
              <option>2/2</option>
              <option>SPRINGER</option>
            </select>
          </label>
          <label>
            Vergütung
            <input
              name="compensation"
              defaultValue={String(editing?.compensation || "")}
              placeholder="2300–2400 € Netto"
            />
          </label>
          <label>
            Standort
            <input
              name="location"
              defaultValue={String(editing?.location || "")}
              placeholder="BER8 / HAJ1"
            />
          </label>
          <label>
            Firma
            <input
              name="company"
              defaultValue={String(editing?.company || "")}
              required
              placeholder="z. B. EuRide GmbH"
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
            <input name="company" placeholder="z. B. EuRide GmbH" />
          </label>
          <label>
            Standort
            <input name="location" placeholder="z. B. BER8" />
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
              {staff.map((s) => (
                <option key={s.id}>{s.full_name}</option>
              ))}
            </select>
          </label>
          <label>
            Standort
            <input
              name="location"
              defaultValue={String(editing?.location || "")}
              placeholder="z. B. BER8"
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
              placeholder="Amazon Block ID"
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
            <input name="base" defaultValue={String(editing?.base || "")} placeholder="z. B. BER8" />
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
