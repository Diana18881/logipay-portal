"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { PortalUser } from "../lib/auth";
import { EmployeeDocuments, ExcelImporter, MaintenanceCenter, PasswordChange, PayrollCenter, SecurityCenter, TruckTracking } from "./advanced-panels";

type Section =
  | "overview"
  | "staff"
  | "vehicles"
  | "tracking"
  | "planning"
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
  documents: Row[];
  files: Row[];
  employeeDocuments: Row[];
  payroll: Row[];
  maintenance: Row[];
  tracking: Row[];
  loginAudit: Row[];
  resetRequests: Row[];
  audit: Row[];
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

export function Portal({ currentUser }: { currentUser: PortalUser }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<Data>({
    staff: [],
    vehicles: [],
    planning: [],
    concerns: [],
    documents: [],
    files: [],
    employeeDocuments: [],
    payroll: [],
    maintenance: [],
    tracking: [],
    loginAudit: [],
    resetRequests: [],
    audit: [],
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
  const [renderedAt] = useState(() => new Date().getTime());
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
          setNotice("Datenbank wird aktualisiert. Bitte Seite neu laden.");
          if (!background) setLoading(false);
          return;
        }
        setData(JSON.parse(body));
      } catch {
        setNotice("Daten konnten nicht geladen werden. Bitte Seite neu laden.");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [year, kw],
  );
  useEffect(() => {
    const initial = window.setTimeout(() => load(), 0);
    const refresh = window.setInterval(() => load(true), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, [load]);
  async function action(payload: Record<string, unknown>) {
    const r = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ error: "Aktion nicht erlaubt" }));
      setNotice(e.error || "Aktion nicht erlaubt");
      return;
    }
    setModal(null);
    setEditing(null);
    setNotice("Änderung gespeichert");
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
  ).length;
  const trackingAlertCount = data.tracking.filter((item) => {
    if (!item.recorded_at) return true;
    const age = renderedAt - new Date(String(item.recorded_at)).getTime();
    return age > 30 * 60_000 || Number(item.speed_kph || 0) > 90;
  }).length;
  const title = nav.find((n) => n.id === section)?.label;
  return (
    <main className={`app-shell role-${currentUser.role}`}>
      {mobileMenu ? <button className="backdrop" aria-label="Menü schließen" onClick={() => setMobileMenu(false)} /> : null}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>LOGIPAY</strong>
            <small>Personal & Disposition</small>
          </div>
        </div>
        <div className="access-card">
          <span className="access-dot" />
          <div>
            <small>ANGEMELDET ALS</small>
            <strong>{labels[currentUser.role]}</strong>
          </div>
        </div>
        <nav>
          <p>ARBEITSBEREICH</p>
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
                        concerns: "!",
                        documents: "€",
                        personnel: "▤",
                        import: "⇧",
                        security: "⌾",
                        reports: "▥",
                      } as Record<string, string>
                    )[n.id]
                  }
                </span>
                {n.label}
                {n.id === "concerns" &&
                ["management", "dispatcher"].includes(currentUser.role) &&
                openConcernCount ? (
                  <span className="nav-counter">{openConcernCount}</span>
                ) : null}
                {n.id === "tracking" && trackingAlertCount ? (
                  <span className="nav-counter">{trackingAlertCount}</span>
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
              <small>{labels[currentUser.role]}</small>
            </div>
          </div>
          <button className="logout-button" onClick={logout}>
            ↪ Abmelden
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Menü öffnen" onClick={() => setMobileMenu(true)}>☰</button>
          <div className="period-control">
            <span>Planungszeitraum</span>
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
              Nächste Woche →
            </button>
          </div>
          <div className="top-actions">
            {["management", "dispatcher"].includes(currentUser.role) ? (
              <button className="pdf-button" onClick={downloadPlanningReport}>
                ↓ Planning Report PDF
              </button>
            ) : null}
            <div className="status-chip">
              <span /> Datenbank verbunden
            </div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p>LOGISTIKVERWALTUNG</p>
              <h1>{title}</h1>
              <span>Zentrale Daten statt einzelner Excel-Tabellen</span>
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
                ＋ Anliegen erfassen
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="empty-state">Daten werden geladen…</div>
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
                  />
                ) : (
                  <>
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
                  <VehicleFiles vehicles={data.vehicles} files={data.files} planning={data.planning} driver={currentUser.role === "driver"} reload={load} />
                  <MaintenanceCenter rows={data.maintenance} vehicles={data.vehicles} canEdit={["management", "dispatcher"].includes(currentUser.role)} action={action} />
                </div>
              )}
              {section === "tracking" && (
                <TruckTracking
                  rows={data.tracking}
                  vehicles={data.vehicles}
                  canManage={["management", "dispatcher"].includes(currentUser.role)}
                  action={action}
                />
              )}
              {section === "planning" && (
                <Card title={`Fahrerplanung ${year} · KW ${kw}`}>
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
                  <PlanningAlerts
                    rows={data.planning}
                    staff={data.staff}
                    vehicles={data.vehicles}
                  />
                  <WeeklySchedule
                    rows={data.planning}
                    staff={active}
                    year={year}
                    kw={kw}
                    showAvailability={currentUser.role !== "driver"}
                    canEdit={currentUser.role !== "driver"}
                    edit={(row) => openModal("planning", row)}
                    remove={(id) => action({ action: "deletePlanning", id })}
                    move={(row, day) => action({ action: "updatePlanning", id: row.id, planningYear: year, calendarWeek: kw, company: row.company, driverName: row.driver_name, location: row.location, licensePlate: row.license_plate, workDays: String(day), startTime: row.start_time || "06:00", blockId: row.block_id, status: row.status, comments: row.comments })}
                  />
                </Card>
              )}
              {section === "concerns" &&
                (currentUser.role === "driver" ? (
                  <DriverConcerns
                    rows={data.concerns}
                    year={year}
                    kw={kw}
                    submit={action}
                  />
                ) : (
                  <Concerns
                    rows={data.concerns}
                    canEdit={currentUser.role !== "accountant"}
                    edit={(r) => openModal("concern", r)}
                    remove={(id) => action({ action: "deleteConcern", id })}
                  />
                ))}
              {section === "documents" && (
                <div className="advanced-stack">
                  <PayrollCenter rows={data.payroll} staff={active} driver={currentUser.role === "driver"} action={action} />
                  <Documents rows={data.documents} staff={active} driver={currentUser.role === "driver"} canUpload={["management", "accountant"].includes(currentUser.role)} reload={load} />
                </div>
              )}
              {section === "personnel" && <EmployeeDocuments rows={data.employeeDocuments} staff={data.staff} driver={currentUser.role === "driver"} reload={load} />}
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
  reload,
}: {
  vehicles: Row[];
  files: Row[];
  planning: Row[];
  driver: boolean;
  reload: () => Promise<void>;
}) {
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
            ? "Mein Fahrzeug · Fotos und Dokumente"
            : "Digitale Fahrzeugakte"
        }
      >
        {driver ? (
          <form className="upload-form" onSubmit={upload}>
            <select name="licensePlate" required>
              <option value="">Kennzeichen wählen</option>
              {plates.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select name="category" required>
              <option value="before">Vor Fahrt</option>
              <option value="after">Nach Fahrt</option>
              <option value="damage">Schaden</option>
              <option value="tuev">TÜV / HU / SP</option>
              <option value="document">Fahrzeugdokument</option>
            </select>
            <input name="notes" placeholder="Notiz" />
            <input
              name="file"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              required
            />
            <button className="primary-button">Hochladen</button>
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
                <th>Datum</th>
                <th>Kennzeichen</th>
                <th>Kategorie</th>
                {!driver ? <th>Fahrer</th> : null}
                <th>Datei</th>
                <th>Notiz</th>
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
                    Noch keine Fotos oder Dokumente.
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
}: {
  person?: Row;
  planning: Row[];
  documents: Row[];
  year: number;
  kw: number;
}) {
  if (!person)
    return (
      <div className="empty-state">
        <b>Ihr Fahrerprofil ist noch nicht verknüpft.</b>
        <br />
        Bitte wenden Sie sich an das Management.
      </div>
    );
  return (
    <>
      <div className="driver-hero">
        <div>
          <small>MEINE VERGÜTUNG</small>
          <strong>{person.compensation || "Noch nicht hinterlegt"}</strong>
          <span>
            {person.company} · {person.location}
          </span>
        </div>
        <div className="pay-breakdown">
          <p>
            <span>Systemart</span>
            <b>{person.system_type || "—"}</b>
          </p>
          <p>
            <span>Urlaub</span>
            <b>{person.vacation || "Kein Urlaub eingetragen"}</b>
          </p>
          <p>
            <span>Planungen KW {kw}</span>
            <b>{planning.length}</b>
          </p>
          <p>
            <span>Lohnabrechnungen</span>
            <b>{documents.length}</b>
          </p>
        </div>
      </div>
      <div className="dashboard-grid">
        <Card title={`Meine Touren und Einsätze · KW ${kw}`}>
          <WeeklySchedule
            rows={planning}
            staff={[person]}
            year={year}
            kw={kw}
          />
        </Card>
        <Card title="Mein Profil">
          <div className="driver-profile">
            <p>
              <span>Name</span>
              <b>{person.full_name}</b>
            </p>
            <p>
              <span>Firma</span>
              <b>{person.company || "—"}</b>
            </p>
            <p>
              <span>Standort</span>
              <b>{person.location || "—"}</b>
            </p>
            <p>
              <span>Status</span>
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="panel employee-panel">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <p>Stand: heute</p>
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

function isoWeekDates(year: number, week: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(
    januaryFourth.getUTCDate() -
      ((januaryFourth.getUTCDay() + 6) % 7) +
      (week - 1) * 7,
  );
  return weekDayNames.map((name, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return {
      number: index + 1,
      name,
      short: name.slice(0, 2),
      date: new Intl.DateTimeFormat("de-DE", {
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
}) {
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [filter, setFilter] = useState("");
  const days = isoWeekDates(year, kw);
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
            <b>{rows.length}</b> Einsätze
          </span>
          {showAvailability ? (
            <span className={conflicts.size ? "stat-conflict" : "stat-ok"}>
              <b>{conflicts.size}</b> Konflikte
            </span>
          ) : null}
        </div>
        <input className="schedule-filter" placeholder="Fahrer, Kennzeichen, Firma, Block…" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="view-switch" aria-label="Planungsansicht">
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            Wochenkalender
          </button>
          <button
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            Tabelle
          </button>
        </div>
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
                              <b>{row.driver_name || "NO DRIVER"}</b>
                              {conflict ? <em>Konflikt</em> : null}
                            </div>
                            <span>{row.company}</span>
                            <small>
                              {row.start_time || "06:00"} ·{" "}
                              {row.license_plate || "Ohne Fahrzeug"} ·{" "}
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
                      <div className="day-empty">Keine Einsätze</div>
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
  submit,
}: {
  rows: Row[];
  year: number;
  kw: number;
  submit: (x: Record<string, unknown>) => void;
}) {
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
      <Card title="Neues Anliegen an die Disposition">
        <form className="driver-concern-form" onSubmit={send}>
          <div>
            <b>Was wird benötigt?</b>
            <span>
              Ihr Name, Firma und das für KW {kw} zugeteilte Kennzeichen werden
              automatisch ergänzt.
            </span>
          </div>
          <textarea
            name="itemName"
            required
            minLength={3}
            placeholder="Zum Beispiel: Feuerlöscher, Warnweste, Motoröl …"
          />
          <input
            name="truckNumber"
            placeholder="Kennzeichen nur falls im Wochenplan noch nicht eingetragen"
          />
          <button className="primary-button">An Disposition senden</button>
        </form>
      </Card>
      <Card title="Meine gesendeten Anliegen">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>LKW</th>
                <th>Anliegen</th>
                <th>Status</th>
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
                  <td colSpan={4}>Noch keine Anliegen gesendet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function Documents({
  rows,
  staff,
  driver,
  canUpload,
  reload,
}: {
  rows: Row[];
  staff: Row[];
  driver: boolean;
  canUpload: boolean;
  reload: () => Promise<void>;
}) {
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
    <Card title={driver ? "Meine Lohnabrechnungen" : "Lohnabrechnungen"}>
      <div className="document-note">
        <b>Sicherer Dokumentenbereich</b>
        <span>
          PDF-Lohnabrechnungen werden personenbezogen gespeichert. Fahrer sehen
          ausschließlich ihre eigenen Dokumente.
        </span>
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
              <th>Mitarbeiter</th>
              <th>Zeitraum</th>
              <th>Datei</th>
              <th>Größe</th>
              <th>Datum</th>
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
                <td colSpan={5}>Noch keine Dokumente hochgeladen.</td>
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
  return (
    <form className="entry-form" onSubmit={go}>
      {kind === "staff" ? (
        <>
          <label>
            Name*
            <input
              name="fullName"
              required
              defaultValue={String(editing?.full_name || "")}
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
                : "E-Mail und Startpasswort anlegen, damit der Fahrer nur seinen eigenen кабинет sieht."}
            </span>
          </div>
          <label>
            Login E-Mail
            <input
              type="email"
              name="loginEmail"
              defaultValue={String(editing?.login_email || "")}
            />
          </label>
          <label>
            {editing?.login_email ? "Neues Passwort" : "Startpasswort"}
            <input type="password" name="loginPassword" minLength={10} />
          </label>
        </>
      ) : kind === "vehicle" ? (
        <>
          <label>
            Kennzeichen*
            <input name="licensePlate" required placeholder="B-AB 1234" />
          </label>
          <label>
            Firma
            <input name="company" />
          </label>
          <label>
            Standort
            <input name="location" />
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
            <input name="notes" />
          </label>
        </>
      ) : kind === "planning" ? (
        <>
          <label>
            Firma*
            <input
              name="company"
              required
              defaultValue={String(editing?.company || "")}
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
            />
          </label>
          <label>
            Kennzeichen
            <input
              name="licensePlate"
              defaultValue={String(editing?.license_plate || "")}
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
            />
          </label>
          <label className="wide">
            Kommentar
            <input
              name="comments"
              defaultValue={String(editing?.comments || "")}
            />
          </label>
        </>
      ) : (
        <>
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
            <input name="base" defaultValue={String(editing?.base || "")} />
          </label>
          <label>
            LKW / Kennzeichen
            <input
              name="truckNumber"
              defaultValue={String(editing?.truck_number || "")}
            />
          </label>
          <label className="wide">
            Anliegen*
            <input
              name="itemName"
              required
              defaultValue={String(editing?.item_name || "")}
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
            <input name="notes" defaultValue={String(editing?.notes || "")} />
          </label>
        </>
      )}
      <button className="primary-button wide" type="submit">
        Speichern
      </button>
    </form>
  );
}
