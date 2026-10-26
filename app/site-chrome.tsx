import Link from "next/link";

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo"><span className="brand-mark"><span /><span /><span /></span><strong>LOGIPAY</strong></Link>
      <nav className="site-nav">
        <Link href="/#funktionen">Funktionen</Link>
        <Link href="/#fahrer-app">Fahrer-App</Link>
        <Link href="/#preise">Preise</Link>
        <Link href="/login" className="site-nav-login">Anmelden</Link>
        {cta ? <Link href="/registrieren" className="site-button site-button-small">Kostenlos testen</Link> : null}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><strong>LOGIPAY</strong><span>Lohn, Touren und Fahrer-App für Transportunternehmen</span></div>
      <nav>
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/agb">AGB</Link>
        <Link href="/avv">Auftragsverarbeitung (AVV)</Link>
        <Link href="/app">Fahrer-App installieren</Link>
      </nav>
    </footer>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <main className="legal-page"><h1>{title}</h1>{children}</main>
      <SiteFooter />
    </div>
  );
}
