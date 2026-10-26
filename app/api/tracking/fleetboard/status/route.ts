import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";
import { hasIntegrationKey } from "../../../../../lib/integration-keys";

export async function GET() {
  await requirePortalUser(["management", "dispatcher"]);
  await ensureDomainDatabase();
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
    bridgeConfigured: await hasIntegrationKey(),
    mappedVehicles: Number(summary?.mapped_vehicles || 0),
    reportingVehicles: Number(summary?.reporting_vehicles || 0),
    lastSyncAt: summary?.last_sync_at || null,
    ingestPath: "/api/tracking/fleetboard/ingest",
  });
}
