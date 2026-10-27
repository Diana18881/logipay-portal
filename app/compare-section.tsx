const rows = [
  { topic: "Lohn vorbereiten", before: "Zahlen aus mehreren Tabellen zusammensuchen und von Hand rechnen", after: "Ein Klick – Zuschläge und Spesen nach deutschen Regeln" },
  { topic: "Nachvollziehbarkeit", before: "Formeln, die nur eine Person versteht", after: "Jede Zahl mit Erklärung, für Büro und Fahrer" },
  { topic: "Steuerbüro", before: "Listen abtippen oder per E-Mail hin und her", after: "DATEV-Datei auf Knopfdruck" },
  { topic: "Belege", before: "Zettel im Handschuhfach, Fotos im Chat", after: "Foto in der App, Prüfung und Erstattung im Portal" },
  { topic: "Touren & Fahrer", before: "WhatsApp-Gruppen und Anrufe", after: "Tour-Chat, Status und Abfahrt in einer App" },
  { topic: "Fristen", before: "Post-it am Monitor", after: "Automatische Erinnerung vor Ablauf" },
];

export function CompareSection() {
  return (
    <section className="lp-section compare" id="vergleich">
      <div className="lp-head" data-reveal><span className="lp-kicker">Vergleich</span><h2>Excel & WhatsApp oder LOGIPAY?</h2></div>
      <div className="compare-table" data-reveal>
        <div className="compare-head"><span /><b className="compare-old">Heute</b><b className="compare-new">Mit LOGIPAY</b></div>
        {rows.map((row, index) => (
          <div className="compare-row" key={row.topic} style={{ transitionDelay: `${index * 60}ms` }}>
            <span className="compare-topic">{row.topic}</span>
            <p className="compare-old"><i>✕</i>{row.before}</p>
            <p className="compare-new"><i>✓</i>{row.after}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
