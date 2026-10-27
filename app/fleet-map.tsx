"use client";

import { useEffect, useRef, useState } from "react";

type Row = Record<string, string | number | null>;

// Live map of the fleet on the office home screen (MapLibre + OpenFreeMap tiles, loaded only when shown).
function statusOf(row: Row) {
  const age = row.recorded_at ? (Date.now() - new Date(String(row.recorded_at)).getTime()) / 60_000 : Infinity;
  if (age > 30) return { tone: "offline", label: "kein Signal" };
  if (Number(row.speed_kph || 0) > 3) return { tone: "moving", label: `${Math.round(Number(row.speed_kph))} km/h` };
  return { tone: "stopped", label: "steht" };
}

export function FleetMap({ tracking, planning, open }: { tracking: Row[]; planning: Row[]; open: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const points = tracking.filter((row) => Number.isFinite(Number(row.latitude)) && row.latitude !== null && row.longitude !== null);
  const key = points.map((row) => `${row.license_plate}:${row.latitude}:${row.longitude}:${row.recorded_at}`).join("|");

  useEffect(() => {
    const element = box.current;
    if (!element || !points.length) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (disposed) return;
      const dark = document.querySelector(".app-shell.theme-dark") || (document.querySelector(".app-shell.theme-system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      map = new maplibre.Map({
        container: element,
        style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        center: [Number(points[0].longitude), Number(points[0].latitude)],
        zoom: 6,
      });
      map.on("error", () => setFailed(true));
      const bounds = new maplibre.LngLatBounds();
      for (const row of points) {
        const status = statusOf(row);
        const driver = planning.find((plan) => plan.license_plate === row.license_plate)?.driver_name;
        const marker = document.createElement("div");
        marker.className = `fleet-marker fleet-${status.tone}`;
        marker.innerHTML = `<span class="fleet-dot"></span><b></b>`;
        (marker.querySelector("b") as HTMLElement).textContent = String(row.license_plate);
        const popup = document.createElement("div");
        popup.className = "fleet-popup";
        popup.innerHTML = "<strong></strong><span></span><small></small>";
        (popup.querySelector("strong") as HTMLElement).textContent = `${row.license_plate}${driver ? ` · ${driver}` : ""}`;
        (popup.querySelector("span") as HTMLElement).textContent = status.label;
        (popup.querySelector("small") as HTMLElement).textContent = String(row.address || "");
        new maplibre.Marker({ element: marker, anchor: "bottom" })
          .setLngLat([Number(row.longitude), Number(row.latitude)])
          .setPopup(new maplibre.Popup({ offset: 24, closeButton: false }).setDOMContent(popup))
          .addTo(map);
        bounds.extend([Number(row.longitude), Number(row.latitude)]);
      }
      map.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 0 });
    })().catch(() => setFailed(true));
    return () => { disposed = true; map?.remove(); };
    // Rebuild when positions change; `key` captures them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const moving = points.filter((row) => statusOf(row).tone === "moving").length;
  const offline = points.filter((row) => statusOf(row).tone === "offline").length;
  return (
    <section className="panel fleet-map-card">
      <header>
        <div><h3>Flotte live</h3><span>{points.length} Fahrzeuge · {moving} in Fahrt{offline ? ` · ${offline} ohne Signal` : ""}</span></div>
        <button type="button" onClick={open}>Zur Karte →</button>
      </header>
      {points.length && !failed ? <div ref={box} className="fleet-map" /> : <div className="fleet-map fleet-map-empty"><p>{failed ? "Karte konnte nicht geladen werden." : "Noch keine GPS-Positionen. Tracker im Bereich „Karte“ verbinden."}</p></div>}
      <div className="fleet-legend"><span><i className="fleet-moving" />in Fahrt</span><span><i className="fleet-stopped" />steht</span><span><i className="fleet-offline" />kein Signal</span></div>
    </section>
  );
}
