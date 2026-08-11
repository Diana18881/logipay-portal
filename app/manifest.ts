import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LOGIPAY Logistikportal",
    short_name: "LOGIPAY",
    description: "Fahrer, Touren, Fahrzeuge, Belege, Lohn und Disposition in einem geschützten Portal.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#07182d",
    orientation: "any",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
