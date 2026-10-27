import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./refresh.css";
import "./mobile.css";
import { ServiceWorker } from "./service-worker";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });

const siteUrl = process.env.APP_URL || "https://logipay-portal.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LOGIPAY — Lohn, Touren und Fahrer-App für Transportunternehmen",
  description: "Lohnvorerfassung mit DATEV-Export, Disposition, Belege und Fahrer-App in einem Portal. 30 Tage kostenlos testen.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "LOGIPAY", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "LOGIPAY",
    url: siteUrl,
    title: "LOGIPAY — Weniger Papier. Mehr Touren.",
    description: "Lohn, Touren, Belege und Fahrer-App für Transportunternehmen – mit DATEV-Export. 30 Tage kostenlos testen.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOGIPAY – Lkw mit LOGIPAY-Logo, Text: Weniger Papier. Mehr Touren." }],
  },
  twitter: { card: "summary_large_image", title: "LOGIPAY — Weniger Papier. Mehr Touren.", description: "Lohn, Touren, Belege und Fahrer-App für Transportunternehmen.", images: ["/og.png"] },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#071a2e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body className={`${geist.variable} ${geist.className}`}>{children}<ServiceWorker /></body></html>;
}
