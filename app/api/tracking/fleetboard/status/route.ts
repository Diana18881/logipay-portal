import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";

type FleetboardEnvironment = typeof env & {
  FLEETBOARD_API_URL?: string;
  FLEETBOARD_API_USER?: string;
  FLEETBOARD_API_PASSWORD?: string;
  TRACKER_INGEST_TOKEN?: string;
};

export async function GET() {
  await requirePortalUser(["management", "dispatcher"]);
  await ensureDomainDatabase();
  const settings = env as FleetboardEnvironment;
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS mapped_vehicles,
      SUM(CASE WHEN last_connected_at IS NOT NULL THEN 1 ELSE 0 END) AS reporting_vehicles,
      MAX(last_connected_at) AS last_sync_at
     FROM truck_trackers WHERE enabled=1 AND lower(provider)='fleetboard'`,
  ).first<{ mapped_vehicles: number; reporting_vehicles: number; last_sync_at: string | null }>();

  return Response.json({
    provider: "Fleetboard",
    service: "Mapping / Track & Trace",
    connector: "SOAP PosService → LOGIPAY bridge",
    credentialsConfigured: Boolean(
      settings.FLEETBOARD_API_URL?.trim() &&
      settings.FLEETBOARD_API_USER?.trim() &&
      settings.FLEETBOARD_API_PASSWORD?.trim(),
    ),
    bridgeConfigured: Boolean(settings.TRACKER_INGEST_TOKEN?.trim()),
    mappedVehicles: Number(summary?.mapped_vehicles || 0),
    reportingVehicles: Number(summary?.reporting_vehicles || 0),
    lastSyncAt: summary?.last_sync_at || null,
    ingestPath: "/api/tracking/fleetboard/ingest",
  });
}
