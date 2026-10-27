import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./refresh.css";
import "./mobile.css";
import { ServiceWorker } from "./service-worker";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "LOGIPAY — Lohn, Touren und Fahrer-App für Transportunternehmen",
  description: "Lohnabrechnung mit DATEV-Export, Disposition, Belege und Fahrer-App in einem Portal. 30 Tage kostenlos testen.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "LOGIPAY", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "LOGIPAY — Portal für Transportunternehmen",
    description: "Lohn. Touren. Fahrer-App.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#071a2e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body className={`${geist.variable} ${geist.className}`}>{children}<ServiceWorker /></body></html>;
}
