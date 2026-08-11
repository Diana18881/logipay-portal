import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const portalUrl = new URL("../app/portal.tsx", import.meta.url);
const operationsUrl = new URL("../app/operations-panels.tsx", import.meta.url);
const cssUrl = new URL("../app/globals.css", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);
const portalApiUrl = new URL("../app/api/portal/route.ts", import.meta.url);
const scanApiUrl = new URL("../app/api/document-scan/route.ts", import.meta.url);
const dailyReportUrl = new URL("../app/api/reports/daily/route.ts", import.meta.url);
const offlineUrl = new URL("../lib/offline-client.ts", import.meta.url);
const fleetboardIngestUrl = new URL("../app/api/tracking/fleetboard/ingest/route.ts", import.meta.url);
const fleetboardStatusUrl = new URL("../app/api/tracking/fleetboard/status/route.ts", import.meta.url);
const fuelStopsUrl = new URL("../app/api/fuel-stops/route.ts", import.meta.url);
const planningReportUrl = new URL("../app/api/reports/planning/route.ts", import.meta.url);

test("provides a dedicated role-protected trip chat inbox", async () => {
  const [portal, operations, portalApi] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(operationsUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
  ]);

  assert.match(portal, /id: "messages", label: "Nachrichten"/);
  assert.match(portal, /roles: \["management", "dispatcher", "driver"\]/);
  assert.match(portal, /view="chat"/);
  assert.match(portal, /unreadChatCount/);
  assert.match(operations, /view\?: "operations" \| "chat"/);
  assert.match(operations, /className="chat-center"/);
  assert.match(operations, /markTripMessagesRead/);
  assert.match(operations, /deleteTripMessage/);
  assert.match(operations, /function TripChatMessage/);
  assert.match(operations, /function TripChatAudio/);
  assert.match(operations, /pauseTripChatPlayers/);
  assert.match(operations, /canModerate/);
  assert.match(operations, /chatModerator/);
  assert.match(portal, /chatModerator=\{\["management", "dispatcher"\]\.includes\(currentUser\.role\)\}/);
  assert.match(portalApi, /action === "deleteTripMessage"/);
  assert.match(operations, /accept="image\/\*,audio\/\*"/);
});

test("ships the refreshed responsive LOGIPAY visual system", async () => {
  const [css, layout] = await Promise.all([
    readFile(cssUrl, "utf8"),
    readFile(layoutUrl, "utf8"),
  ]);

  assert.match(css, /\.overview-command-card/);
  assert.match(css, /\.top-chat-button/);
  assert.match(css, /\.chat-inbox/);
  assert.match(css, /\.chat-conversation/);
  assert.match(css, /@media screen and \(max-width: 760px\)/);
  assert.match(layout, /LOGIPAY/);
  assert.doesNotMatch(layout, /Starter Project|sandbox-preview/);
});

test("includes the operations command center, global search and driver 360 dossier", async () => {
  const [portal, css, portalApi] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(cssUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
  ]);

  assert.match(portal, /className="smart-status-grid"/);
  assert.match(portal, /className=\{`global-search/);
  assert.match(portal, /function DispatchBoard/);
  assert.match(portal, /application\/x-logipay/);
  assert.match(portal, /FAHRER 360°/);
  assert.match(portal, /Touren & Kommunikation/);
  assert.match(css, /\.dispatch-board/);
  assert.match(css, /\.dossier-kpis/);
  assert.match(css, /\.global-search-results/);
  assert.match(portalApi, /action === "movePlanningResource"/);
  assert.match(portalApi, /env\.DB\.batch/);
});

test("includes unified tasks, driver workflow and personal interface settings", async () => {
  const [portal, css] = await Promise.all([readFile(portalUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(portal, /id: "tasks", label: "Aufgabenzentrale"/);
  assert.match(portal, /function TaskCenter/);
  assert.match(portal, /function DriverWorkflow/);
  assert.match(portal, /function InterfaceSettings/);
  assert.match(css, /\.task-center-summary/);
  assert.match(css, /\.driver-flow-steps/);
  assert.match(css, /\.theme-dark/);
  assert.match(css, /\.density-compact/);
});

test("ships offline file synchronization, document recognition and digital approvals", async () => {
  const [portal, operations, api, scan, offline] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(operationsUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
    readFile(scanApiUrl, "utf8"),
    readFile(offlineUrl, "utf8"),
  ]);
  assert.match(portal, /flushOfflineUploads/);
  assert.match(operations, /queueOfflineUpload\("\/api\/trip-chat"/);
  assert.match(operations, /\/api\/document-scan/);
  assert.match(api, /action === "digitalApproval"/);
  assert.match(scan, /confidence/);
  assert.match(offline, /indexedDB/);
});

test("includes the fleet trail map and management daily PDF", async () => {
  const [advanced, daily, css] = await Promise.all([
    readFile(new URL("../app/advanced-panels.tsx", import.meta.url), "utf8"),
    readFile(dailyReportUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.match(advanced, /map-trail/);
  assert.match(advanced, /GPS-Signal verloren/);
  assert.match(advanced, /activeOperation/);
  assert.match(css, /\.map-fleet-marker/);
  assert.match(daily, /dailyManagementReport/);
  assert.match(daily, /PDFDocument/);
});

test("includes the secure Fleetboard live GPS connector", async () => {
  const [advanced, ingest, status, css] = await Promise.all([
    readFile(new URL("../app/advanced-panels.tsx", import.meta.url), "utf8"),
    readFile(fleetboardIngestUrl, "utf8"),
    readFile(fleetboardStatusUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.match(advanced, /Fleetboard Live GPS/);
  assert.match(advanced, /Fleetboard Fahrzeug-ID \/ VIN/);
  assert.match(advanced, /\/api\/tracking\/fleetboard\/status/);
  assert.match(ingest, /TRACKER_INGEST_TOKEN/);
  assert.match(ingest, /source, recorded_at, received_at.*'fleetboard'/s);
  assert.match(status, /credentialsConfigured/);
  assert.match(status, /requirePortalUser\(\["management", "dispatcher"\]\)/);
  assert.match(css, /\.fleetboard-connect-panel/);
});

test("shows a complete vehicle registry with photo and maintenance tabs", async () => {
  const [portal, css] = await Promise.all([readFile(portalUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(portal, /Gesamter Fuhrpark/);
  assert.match(portal, /type VehicleTab = "overview" \| "before" \| "after" \| "week"/);
  assert.match(portal, /vehicle-photo-gallery/);
  assert.match(portal, /Fahrzeugzustand vor dem Einsatz/);
  assert.match(portal, /Fahrzeugzustand nach dem Einsatz/);
  assert.match(portal, /WERKSTATTHISTORIE/);
  assert.match(css, /\.vehicle-fleet-grid/);
  assert.match(css, /\.vehicle-record-tabs/);
  assert.match(css, /\.vehicle-photo-card/);
});

test("ships a permanent vehicle dossier with weekly photos, fuel evidence and manager comments", async () => {
  const [portal, api, fuelApi, report, css] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
    readFile(fuelStopsUrl, "utf8"),
    readFile(planningReportUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.match(portal, /Wochenbeginn · LKW \+ Kilometerstand/);
  assert.match(portal, /Vier Fotos sind Pflicht|4 Fotos sicher an Buchhaltung senden/);
  assert.match(portal, /function FuelBarcode/);
  assert.match(portal, /Manager-Kommentare/);
  assert.match(api, /action === "addVehicleComment"/);
  assert.match(api, /action === "saveFuelCode" && user\.role === "management"/);
  assert.match(fuelApi, /requirePortalUser\(\["driver"\]\)/);
  assert.match(fuelApi, /stationPhoto.*dieselPhoto.*adbluePhoto.*receiptPhoto/);
  assert.match(fuelApi, /INSERT INTO expenses/);
  assert.match(report, /vehicleTab=comments/);
  assert.match(report, /Subtype: "Link"/);
  assert.match(css, /\.fuel-proof-grid/);
  assert.match(css, /\.vehicle-comments/);
});

test("provides a shared dispatcher driver rating and availability center", async () => {
  const [portal, api, schema, css] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.match(portal, /function DriverControlCenter/);
  assert.match(portal, /<h2>Fahrerbewertung<\/h2>/);
  assert.match(portal, /openVehicleProfile/);
  assert.match(portal, /Bewertung & Vorfälle/);
  assert.match(portal, /star-rating-input/);
  assert.match(portal, /Bewertung senden/);
  assert.match(portal, /driver-rating-table/);
  assert.match(portal, /computeDriverMetrics/);
  assert.match(portal, /Letzte gesendete Bewertungen/);
  assert.doesNotMatch(portal, /title="Verspätung markieren"/);
  assert.match(portal, /dossier-archive-action/);
  assert.match(api, /action === "addDriverPerformance"/);
  assert.match(api, /\["management", "dispatcher"\]\.includes\(user\.role\)/);
  assert.match(api, /Fahrer nicht erschienen/);
  assert.match(api, /\["rating", "no_show", "accident", "comment"\]/);
  assert.match(api, /NULL AS compensation/);
  assert.match(schema, /driverPerformanceEvents/);
  assert.match(schema, /idx_driver_performance_staff_date/);
  assert.match(css, /\.driver-control-center/);
  assert.match(css, /\.driver-event-modal/);
});

test("includes planning alerts for TÜV, documents and tachograph plus driver ratings in dispatch", async () => {
  const [portal, css] = await Promise.all([readFile(portalUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(portal, /expiringDocuments30/);
  assert.match(portal, /expiringTuv30/);
  assert.match(portal, /tachographViolations/);
  assert.match(portal, /Tachograph-Verstoß/);
  assert.match(portal, /function DriverPlanningRating/);
  assert.match(portal, /driverRatingMap=\{driverRatingMap\}/);
  assert.match(portal, /employeeDocuments=\{data\.employeeDocuments\}/);
  assert.match(css, /\.planning-driver-rating/);
});

test("requires driver departure confirmation with 12h deadline and replacement alerts", async () => {
  const [portal, api, css, lib] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
    readFile(cssUrl, "utf8"),
    readFile(new URL("../lib/departure-confirmations.ts", import.meta.url), "utf8"),
  ]);
  assert.match(portal, /departureConfirmations/);
  assert.match(portal, /function DepartureConfirmBadge/);
  assert.match(portal, /Ersatzfahrer suchen/);
  assert.match(portal, /confirmDeparture/);
  assert.match(portal, /departureShifts=\{departureShifts\}/);
  assert.match(api, /action === "confirmDeparture"/);
  assert.match(api, /planning_departure_confirmations/);
  assert.match(lib, /CONFIRM_WINDOW_HOURS = 12/);
  assert.match(css, /\.departure-overdue/);
  assert.match(css, /\.assignment-departure-overdue/);
});
