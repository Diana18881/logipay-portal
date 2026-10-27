"use client";

import { useEffect, useRef, useState } from "react";

// Drivers tap a photo field → a full-screen camera with a receipt frame opens; the photo is cropped to the frame
// and put into the original file field. "Aus Galerie" falls back to the normal file picker.

type Copy = { hint: string; shoot: string; gallery: string; cancel: string; denied: string };
const copy: Record<string, Copy> = {
  de: { hint: "Beleg in den Rahmen halten", shoot: "Foto aufnehmen", gallery: "Aus Galerie", cancel: "Abbrechen", denied: "Kamera nicht verfügbar – bitte Galerie nutzen." },
  pl: { hint: "Umieść paragon w ramce", shoot: "Zrób zdjęcie", gallery: "Z galerii", cancel: "Anuluj", denied: "Aparat niedostępny – użyj galerii." },
  uk: { hint: "Тримайте чек у рамці", shoot: "Зробити фото", gallery: "З галереї", cancel: "Скасувати", denied: "Камера недоступна – оберіть з галереї." },
  ru: { hint: "Держите чек в рамке", shoot: "Сделать фото", gallery: "Из галереи", cancel: "Отмена", denied: "Камера недоступна – выберите из галереи." },
};

export function FrameCamera({ locale }: { locale: string }) {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const bypass = useRef(false);
  const c = copy[locale] || copy.de;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const input = (event.target as HTMLElement | null)?.closest?.("input[type=file]") as HTMLInputElement | null;
      if (!input || bypass.current || !/image/.test(input.accept || "") || !navigator.mediaDevices?.getUserMedia) return;
      event.preventDefault();
      setError("");
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
    // The frame covers 82 % of the width and 62 % of the height of the visible video, centred.
    const width = element.videoWidth, height = element.videoHeight;
    const viewRatio = element.clientWidth / element.clientHeight;
    let visibleW = width, visibleH = height;
    if (width / height > viewRatio) visibleW = height * viewRatio; else visibleH = width / viewRatio;
    const cropW = visibleW * 0.82, cropH = visibleH * 0.62;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    canvas.getContext("2d")!.drawImage(element, (width - cropW) / 2, (height - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
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
  return (
    <div className="frame-camera" role="dialog" aria-label={c.hint}>
      <video ref={video} playsInline muted />
      <div className="frame-camera-mask"><div className="frame-camera-box"><i /><i /><i /><i /></div></div>
      <p className="frame-camera-hint">{error || c.hint}</p>
      <div className="frame-camera-actions">
        <button type="button" onClick={close}>{c.cancel}</button>
        <button type="button" className="frame-camera-shoot" onClick={shoot} disabled={Boolean(error)} aria-label={c.shoot}><span /></button>
        <button type="button" onClick={gallery}>{c.gallery}</button>
      </div>
    </div>
  );
}
