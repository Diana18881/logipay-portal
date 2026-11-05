"use client";

import { useEffect, useRef, useState } from "react";

// Drivers tap a photo field → a full-screen camera with a frame for the receipt, document card, page or vehicle opens; the photo is cropped to the frame
// and put into the original file field. "Aus Galerie" falls back to the normal file picker.

type Kind = "receipt" | "card" | "page" | "vehicle" | "photo";
type Copy = { hint: Record<Kind, string>; shoot: string; gallery: string; cancel: string; denied: string };
// {x} is replaced by the document type (e.g. "Führerschein"); without one the word in brackets is used.
const copy: Record<string, Copy> = {
  de: { hint: { receipt: "Beleg in den Rahmen halten", card: "{x|Karte} in den Rahmen halten", page: "{x|Dokument} in den Rahmen halten", vehicle: "Fahrzeug ins Bild nehmen", photo: "{x|Motiv} ins Bild nehmen" }, shoot: "Foto aufnehmen", gallery: "Aus Galerie", cancel: "Abbrechen", denied: "Kamera nicht verfügbar – bitte Galerie nutzen." },
  pl: { hint: { receipt: "Umieść paragon w ramce", card: "Umieść {x|kartę} w ramce", page: "Umieść {x|dokument} w ramce", vehicle: "Uchwyć pojazd w kadrze", photo: "Uchwyć w kadrze: {x|motyw}" }, shoot: "Zrób zdjęcie", gallery: "Z galerii", cancel: "Anuluj", denied: "Aparat niedostępny – użyj galerii." },
  uk: { hint: { receipt: "Тримайте чек у рамці", card: "Тримайте {x|картку} у рамці", page: "Тримайте {x|документ} у рамці", vehicle: "Наведіть камеру на авто", photo: "Наведіть камеру: {x|предмет}" }, shoot: "Зробити фото", gallery: "З галереї", cancel: "Скасувати", denied: "Камера недоступна – оберіть з галереї." },
  ru: { hint: { receipt: "Держите чек в рамке", card: "Держите {x|карту} в рамке", page: "Держите {x|документ} в рамке", vehicle: "Наведите камеру на машину", photo: "Наведите камеру: {x|предмет}" }, shoot: "Сделать фото", gallery: "Из галереи", cancel: "Отмена", denied: "Камера недоступна – выберите из галереи." },
};
const CARDS = /führerschein|fahrerkarte|aufenthalt|ausweis|code 95|karte/i;

/** What is being photographed: data-frame on the input, or the document type chosen in the same form. */
function describe(input: HTMLInputElement): { kind: Kind; label: string } {
  const label = input.dataset.frameLabel || (input.form?.querySelector("select[name=category]") as HTMLSelectElement | null)?.selectedOptions[0]?.textContent?.trim() || "";
  const declared = input.dataset.frame as Kind | "document" | undefined;
  if (declared === "document") return { kind: CARDS.test(label) ? "card" : "page", label };
  return { kind: declared || "receipt", label };
}

export function FrameCamera({ locale }: { locale: string }) {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [subject, setSubject] = useState<{ kind: Kind; label: string }>({ kind: "receipt", label: "" });
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const bypass = useRef(false);
  const c = copy[locale] || copy.de;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const input = (event.target as HTMLElement | null)?.closest?.("input[type=file]") as HTMLInputElement | null;
      // Only on phones and tablets; on a computer the normal file picker is the better choice.
      if (!input || bypass.current || input.dataset.noFrame || !/image/.test(input.accept || "") || !navigator.mediaDevices?.getUserMedia || !window.matchMedia("(pointer: coarse)").matches) return;
      event.preventDefault();
      setError("");
      setSubject(describe(input));
      setTarget(input);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((media) => {
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; void video.current.play(); }
      })
      .catch(() => setError(c.denied));
    return () => { cancelled = true; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
  }, [target, c.denied]);

  function close() { setTarget(null); }

  function gallery() {
    const input = target;
    close();
    if (!input) return;
    bypass.current = true;
    input.click();
    window.setTimeout(() => { bypass.current = false; }, 400);
  }

  function shoot() {
    const element = video.current;
    const input = target;
    if (!element || !input || !element.videoWidth) return;
    // Crop exactly what is inside the frame: map the frame's screen box onto the video (shown with object-fit: cover).
    const width = element.videoWidth, height = element.videoHeight;
    const view = element.getBoundingClientRect();
    const frame = box.current?.getBoundingClientRect() ?? view;
    const scale = Math.max(view.width / width, view.height / height);
    const offsetX = (view.width - width * scale) / 2, offsetY = (view.height - height * scale) / 2;
    const sx = Math.max(0, (frame.left - view.left - offsetX) / scale), sy = Math.max(0, (frame.top - view.top - offsetY) / scale);
    const cropW = Math.min(width - sx, frame.width / scale), cropH = Math.min(height - sy, frame.height / scale);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    canvas.getContext("2d")!.drawImage(element, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      try { navigator.vibrate?.(15); } catch { /* optional */ }
      close();
    }, "image/jpeg", 0.88);
  }

  if (!target) return null;
  const hint = c.hint[subject.kind].replace(/\{x\|([^}]*)\}/, (_, fallback) => subject.label || fallback);
  return (
    <div className={`frame-camera frame-${subject.kind}`} role="dialog" aria-label={hint}>
      <video ref={video} playsInline muted />
      <div className="frame-camera-mask"><div ref={box} className="frame-camera-box"><i /><i /><i /><i /></div></div>
      <p className="frame-camera-hint">{error || hint}</p>
      <div className="frame-camera-actions">
        <button type="button" onClick={close}>{c.cancel}</button>
        <button type="button" className="frame-camera-shoot" onClick={shoot} disabled={Boolean(error)} aria-label={c.shoot}><span /></button>
        <button type="button" onClick={gallery}>{c.gallery}</button>
      </div>
    </div>
  );
}
