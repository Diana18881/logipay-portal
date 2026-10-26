import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LOGIPAY Fahrer-App & Portal",
    short_name: "LOGIPAY",
    description: "Touren, Belege, Nachrichten und Lohn – die App für Fahrer und Büro.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#071a2e",
    theme_color: "#071a2e",
    orientation: "portrait",
    lang: "de",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
