"use client";

import { useState } from "react";

export function AboActions({ billingReady, hasSubscription, hasCustomer, companyName, canDelete }: { billingReady: boolean; hasSubscription: boolean; hasCustomer: boolean; companyName: string; canDelete: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  async function go(path: string) {
    setError("");
    setBusy(true);
    const response = await fetch(path, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setError(result.error || "Aktion fehlgeschlagen");
      setBusy(false);
      return;
    }
    window.location.href = result.url;
  }

  async function deleteCompany() {
    setError("");
    setBusy(true);
    const response = await fetch("/api/company/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmName }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Löschen fehlgeschlagen");
      setBusy(false);
      return;
    }
    window.location.href = "/?geloescht=1";
  }

  return (
    <>
      <div className="abo-actions">
        {billingReady && !hasSubscription ? <button className="site-button" disabled={busy} onClick={() => void go("/api/billing/checkout")}>Abonnement abschließen</button> : null}
        {billingReady && hasCustomer ? <button className="site-button site-button-ghost" disabled={busy} onClick={() => void go("/api/billing/portal")}>Zahlungsdaten, Rechnungen & Kündigung</button> : null}
        {!billingReady ? <p className="abo-note">Die Online-Zahlung ist noch nicht freigeschaltet. Bitte kontaktieren Sie den Anbieter.</p> : null}
      </div>
      {error ? <div className="login-error">{error}</div> : null}
      <section className="abo-data">
        <h2>Ihre Daten</h2>
        <p>Laden Sie jederzeit alle Daten Ihrer Firma als Datei herunter (Art. 20 DSGVO).</p>
        <a className="site-button site-button-ghost" href="/api/company/export">Alle Daten exportieren</a>
        {canDelete ? <div className="abo-danger">
          <h3>Firma endgültig löschen</h3>
          <p>Löscht die Datenbank, alle Dateien und alle Zugänge Ihrer Firma sofort und unwiderruflich. Ein laufendes Abonnement wird beendet. Exportieren Sie vorher Ihre Daten.</p>
          <label>Zum Bestätigen Firmennamen eintippen: <b>{companyName}</b><input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></label>
          <button className="danger-button" disabled={busy || confirmName.trim() !== companyName} onClick={() => void deleteCompany()}>Firma und alle Daten löschen</button>
        </div> : null}
      </section>
    </>
  );
}
