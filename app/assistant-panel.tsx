"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const suggestions: Record<string, string[]> = {
  de: ["Was ist heute dringend?", "Welche Touren haben Verspätung?", "Welche Dokumente laufen bald ab?", "Fasse die Woche zusammen"],
  ru: ["Что сегодня срочно?", "Какие рейсы с опозданием?", "Какие документы скоро истекают?", "Сделай сводку по неделе"],
  uk: ["Що сьогодні термінове?", "Які рейси із запізненням?", "Які документи скоро закінчуються?", "Зроби підсумок тижня"],
  pl: ["Co jest dziś pilne?", "Które trasy mają opóźnienie?", "Które dokumenty wkrótce wygasają?", "Podsumuj tydzień"],
};

function AssistantPanel({ context, locale, section }: { context: unknown; locale: string; section: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next); setInput(""); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context, locale, section }) });
      const result = await response.json() as { reply?: string; error?: string };
      if (!response.ok) setError(result.error || "Fehler");
      else setTurns([...next, { role: "assistant", content: result.reply || "" }]);
    } catch { setError("Keine Verbindung"); }
    setBusy(false);
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }

  return <div className="assistant-panel panel">
    <div className="assistant-stream">
      {!turns.length ? <div className="assistant-welcome"><span>✦</span><h2>Assistent</h2><p>Fragen Sie zu Touren, Fahrern, Fahrzeugen, Abrechnungen oder offenen Aufgaben.</p>
        <div className="assistant-suggestions">{(suggestions[locale] || suggestions.de).map((item) => <button key={item} type="button" onClick={() => send(item)}>{item}</button>)}</div></div> : null}
      {turns.map((turn, index) => <div key={index} className={`assistant-bubble assistant-${turn.role}`}>{turn.content}</div>)}
      {busy ? <div className="assistant-bubble assistant-assistant assistant-typing"><i /><i /><i /></div> : null}
      {error ? <div className="inline-notice">{error}</div> : null}
      <div ref={endRef} />
    </div>
    <form className="assistant-composer" onSubmit={submit}>
      <textarea value={input} rows={1} placeholder="Frage stellen …" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} />
      <button className="primary-button" disabled={busy || !input.trim()}>➤</button>
    </form>
  </div>;
}

export function AssistantWidget({ context, locale, section }: { context: unknown; locale: string; section: string }) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open || configured !== null) return;
    fetch("/api/assistant").then((response) => response.json()).then((result: { configured?: boolean }) => setConfigured(Boolean(result.configured))).catch(() => setConfigured(true));
  }, [open, configured]);
  return <div className="assistant-widget">
    {open ? <div className="assistant-window" role="dialog" aria-label="Assistent">
      <header><span>✦</span><div><b>Assistent</b><small>Automatische Antworten zu Touren, Fahrern & Abrechnung</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Schließen">✕</button></header>
      {configured === false ? <div className="assistant-setup"><b>Assistent noch nicht aktiviert</b><p>Der Administrator muss in Vercel (Settings → Environment Variables) die Variablen <code>AI_GATEWAY_API_KEY</code> und <code>AI_MODEL</code> eintragen und die Seite neu deployen.</p></div> : <AssistantPanel context={context} locale={locale} section={section} />}
    </div> : null}
    <button type="button" className="assistant-fab" onClick={() => setOpen(!open)} aria-label="Assistent öffnen">{open ? "✕" : "✦"}</button>
  </div>;
}
