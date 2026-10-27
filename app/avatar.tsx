"use client";

import { createContext, useContext } from "react";

/** staffId → photo version; filled by the portal from the staff list. */
export const PhotoContext = createContext<Map<string, string>>(new Map());

const initials = (name: unknown) => String(name || "?").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function Avatar({ name, staffId, className = "", as: Tag = "span" }: { name: unknown; staffId?: unknown; className?: string; as?: "span" | "div" }) {
  const photos = useContext(PhotoContext);
  const version = staffId != null ? photos.get(String(staffId)) : undefined;
  if (version) return <Tag className={`${className} has-photo`}><img src={`/api/staff-photo/${staffId}?v=${encodeURIComponent(version)}`} alt="" loading="lazy" /></Tag>;
  return <Tag className={className}>{initials(name)}</Tag>;
}

/** Shrinks a photo to a square of 400 px in the browser before upload. */
export async function squarePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 400; canvas.height = 400;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 400, 400);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Foto konnte nicht verarbeitet werden");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

export async function uploadStaffPhoto(staffId: unknown, file: File) {
  const form = new FormData();
  form.set("staffId", String(staffId));
  form.set("file", await squarePhoto(file));
  const response = await fetch("/api/staff-photo", { method: "POST", body: form });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Foto konnte nicht gespeichert werden");
}
